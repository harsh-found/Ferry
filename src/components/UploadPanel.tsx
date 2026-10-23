import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ban, Check, ClipboardPaste, CloudUpload, Copy, FolderOpen, Globe, LoaderCircle, Recycle, RotateCcw, ShieldCheck, Timer, Type, X,
} from 'lucide-react';
import { EXPIRY_OPTIONS, FOREVER_TS, type ExpirySeconds, type ProviderId, type QueueItem, type TrackedFile } from '../lib/types';
import { MAX_SIZE, categoryOf, copyText, formatBytes, formatEta, uid } from '../lib/format';
import { makeThumb, sha256 } from '../lib/media';
import { UploadAbort, uploadFile } from '../lib/upload';
import { PROVIDERS, PROVIDER_IDS } from '../lib/providers';
import { useFiles } from '../lib/store';
import { useToast } from '../lib/ui';
import { FileBadge } from './FileVisual';

const CONCURRENCY = 3;

export default function UploadPanel({ onOpenFile, pickRef }: { onOpenFile: (id: string) => void; pickRef: React.MutableRefObject<(() => void) | null> }) {
  const { files, add } = useFiles();
  const toast = useToast();
  const [provider, setProvider] = useState<ProviderId>(() => {
    const v = localStorage.getItem('ferry.provider') as ProviderId | null;
    return v && PROVIDERS[v] ? v : 'onlyfiles';
  });
  const [expiry, setExpiry] = useState<ExpirySeconds>(() => {
    const v = Number(localStorage.getItem('ferry.expiry'));
    return (EXPIRY_OPTIONS.some((o) => o.value === v) ? v : 86400) as ExpirySeconds;
  });
  const [dedupe, setDedupe] = useState(() => localStorage.getItem('ferry.dedupe') !== '0');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const [snippet, setSnippet] = useState<{ open: boolean; name: string; text: string }>({ open: false, name: 'note.txt', text: '' });

  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  const dedupeRef = useRef(dedupe);
  const active = useRef(new Set<string>());
  const aborts = useRef(new Map<string, () => void>());
  const canceled = useRef(new Set<string>());
  const dragDepth = useRef(0);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    dedupeRef.current = dedupe;
    localStorage.setItem('ferry.dedupe', dedupe ? '1' : '0');
  }, [dedupe]);
  useEffect(() => {
    localStorage.setItem('ferry.expiry', String(expiry));
  }, [expiry]);
  useEffect(() => {
    localStorage.setItem('ferry.provider', provider);
  }, [provider]);

  const switchProvider = (pid: ProviderId) => {
    setProvider(pid);
    if (expiry === 0 && !PROVIDERS[pid].supportsForever) {
      setExpiry(86400);
    }
  };

  const availableExpiry = EXPIRY_OPTIONS.filter((o) => !o.forever || PROVIDERS[provider].supportsForever);

  const patch = useCallback((id: string, p: Partial<QueueItem>) => {
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const enqueue = useCallback(
    (list: File[] | FileList) => {
      const arr = Array.from(list);
      if (!arr.length) return;
      const items: QueueItem[] = arr.map((file) => {
        const base: QueueItem = { id: uid(), file, name: file.name || 'untitled', size: file.size, status: 'queued', loaded: 0, speed: 0, expiry, provider };
        if (file.size > MAX_SIZE) return { ...base, status: 'error', error: `Too large — max 100 MB (${formatBytes(file.size)})` };
        if (file.size === 0) return { ...base, status: 'error', error: 'Empty file (0 bytes)' };
        return base;
      });
      setQueue((q) => [...items, ...q]);
      const rejected = items.filter((i) => i.status === 'error').length;
      if (rejected) toast({ tone: 'err', title: `${rejected} file${rejected > 1 ? 's' : ''} rejected`, desc: 'Files must be between 1 byte and 100 MB' });
    },
    [expiry, provider, toast],
  );

  useEffect(() => {
    pickRef.current = () => inputRef.current?.click();
  }, [pickRef]);

  const start = useCallback(
    async (item: QueueItem) => {
      active.current.add(item.id);
      patch(item.id, { status: 'preparing', loaded: 0, speed: 0, error: undefined });
      try {
        const [hash, thumb] = await Promise.all([
          sha256(item.file).catch(() => undefined),
          makeThumb(item.file).catch(() => undefined),
        ]);
        if (canceled.current.has(item.id)) throw new UploadAbort();

        if (dedupeRef.current && hash) {
          const dup = filesRef.current.find((f) => f.sha256 === hash && f.expiresAt > Date.now() + 5 * 60_000);
          if (dup) {
            patch(item.id, { status: 'done', loaded: item.size, fileId: dup.id, reused: true });
            toast({ tone: 'info', title: 'Duplicate detected — link reused', desc: dup.label || dup.name });
            return;
          }
        }

        patch(item.id, { status: 'uploading' });
        let last = { t: performance.now(), l: 0 };
        let speed = 0;
        const { promise, abort } = uploadFile(item.provider, item.file, item.expiry, (loaded) => {
          const now = performance.now();
          const dt = (now - last.t) / 1000;
          if (dt >= 0.3) {
            const inst = (loaded - last.l) / dt;
            speed = speed ? speed * 0.6 + inst * 0.4 : inst;
            last = { t: now, l: loaded };
          }
          patch(item.id, { loaded, speed });
        });
        aborts.current.set(item.id, abort);
        const url = await promise;
        const now = Date.now();
        const tf: TrackedFile = {
          id: uid(),
          name: item.name,
          label: item.name,
          size: item.size,
          mime: item.file.type || 'application/octet-stream',
          category: categoryOf(item.file.type || '', item.name),
          url,
          uploadedAt: now,
          expiresAt: item.expiry === 0 ? FOREVER_TS : now + item.expiry * 1000,
          expiry: item.expiry,
          sha256: hash,
          thumb,
          tags: [],
          note: '',
          pinned: false,
          provider: item.provider,
        };
        add(tf);
        patch(item.id, { status: 'done', loaded: item.size, fileId: tf.id });
      } catch (e) {
        if (e instanceof UploadAbort || canceled.current.has(item.id)) {
          patch(item.id, { status: 'canceled' });
        } else {
          const msg = e instanceof Error ? e.message : 'Upload failed';
          patch(item.id, { status: 'error', error: msg });
          toast({ tone: 'err', title: 'Upload failed', desc: `${item.name}: ${msg}` });
        }
      } finally {
        active.current.delete(item.id);
        aborts.current.delete(item.id);
        canceled.current.delete(item.id);
        setQueue((q) => [...q]);
      }
    },
    [add, patch, toast],
  );

  useEffect(() => {
    const slots = CONCURRENCY - active.current.size;
    if (slots <= 0) return;
    const next = queue.filter((q) => q.status === 'queued' && !active.current.has(q.id)).reverse().slice(0, slots);
    next.forEach((n) => void start(n));
  }, [queue, start]);

  // Toast when a batch completes
  const prevBusy = useRef(false);
  const busy = queue.some((q) => q.status === 'queued' || q.status === 'preparing' || q.status === 'uploading');
  useEffect(() => {
    if (prevBusy.current && !busy) {
      const done = queue.filter((q) => q.status === 'done' && !q.reused).length;
      if (done) toast({ tone: 'ok', title: 'All uploads finished', desc: `${done} file${done > 1 ? 's' : ''} now tracked in your library` });
    }
    prevBusy.current = busy;
  }, [busy, queue, toast]);

  // Global drag & drop + paste
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      setHover(false);
      if (e.dataTransfer?.files?.length) enqueue(e.dataTransfer.files);
    };
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const fl = e.clipboardData?.files;
      if (fl && fl.length) {
        e.preventDefault();
        const renamed = Array.from(fl).map((f) =>
          f.name === 'image.png' ? new File([f], `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`, { type: f.type }) : f,
        );
        enqueue(renamed);
        toast({ tone: 'info', title: `Pasted ${fl.length} file${fl.length > 1 ? 's' : ''} from clipboard` });
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, [enqueue, toast]);

  const cancel = (item: QueueItem) => {
    canceled.current.add(item.id);
    const ab = aborts.current.get(item.id);
    if (ab) ab();
    else if (item.status === 'queued') {
      canceled.current.delete(item.id);
      patch(item.id, { status: 'canceled' });
    }
  };
  const retry = (item: QueueItem) => {
    if (item.size > MAX_SIZE || item.size === 0) return;
    patch(item.id, { status: 'queued', loaded: 0, speed: 0, error: undefined });
  };
  const cancelAll = () => queue.forEach((q) => (q.status === 'queued' || q.status === 'uploading' || q.status === 'preparing') && cancel(q));
  const clearFinished = () => setQueue((q) => q.filter((i) => i.status === 'queued' || i.status === 'preparing' || i.status === 'uploading'));

  const copyLink = async (item: QueueItem) => {
    const f = filesRef.current.find((x) => x.id === item.fileId);
    if (!f) return;
    const ok = await copyText(f.url);
    toast(ok ? { tone: 'ok', title: 'Link copied', desc: f.url } : { tone: 'err', title: 'Copy failed' });
  };

  const submitSnippet = () => {
    if (!snippet.text.trim()) return;
    let name = snippet.name.trim() || 'note.txt';
    if (!/\.[a-z0-9]+$/i.test(name)) name += '.txt';
    enqueue([new File([snippet.text], name, { type: 'text/plain' })]);
    setSnippet({ open: false, name: 'note.txt', text: '' });
  };

  const inflight = queue.filter((q) => q.status === 'uploading' || q.status === 'preparing' || q.status === 'queued');
  const totalBytes = inflight.reduce((s, q) => s + q.size, 0);
  const loadedBytes = inflight.reduce((s, q) => s + q.loaded, 0);
  const totalSpeed = inflight.reduce((s, q) => s + (q.status === 'uploading' ? q.speed : 0), 0);
  const overall = totalBytes ? (loadedBytes / totalBytes) * 100 : 0;

  return (
    <div className="relative">
      {/* Full-screen drop overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-bg/80 p-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              className="grid h-full w-full place-items-center rounded-[2rem] border-2 border-dashed border-ink/40"
            >
              <div className="text-center">
                <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-accent text-accent-ink">
                  <CloudUpload className="h-10 w-10" />
                </div>
                <p className="font-display text-4xl font-bold tracking-tight sm:text-6xl">Drop to ferry</p>
                <p className="mt-3 font-mono text-sm text-muted">
                  {expiry === 0 ? 'hosted forever' : `expires in ${EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label}`} · {PROVIDERS[provider].name} · max 100 MB each
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]">
        {/* Provider selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-muted" />
            Host
          </div>
          <div className="relative flex rounded-xl bg-surface-2 p-1">
            {PROVIDER_IDS.map((pid) => {
              const p = PROVIDERS[pid];
              return (
                <button
                  key={pid}
                  onClick={() => switchProvider(pid)}
                  className={`relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${provider === pid ? 'text-accent-ink' : 'text-muted hover:text-ink'}`}
                >
                  {provider === pid && (
                    <motion.span layoutId="provider-pill" className="absolute inset-0 -z-10 rounded-lg bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
                  )}
                  {p.name}
                  {p.supportsForever && <span className="ml-0.5 text-[10px] opacity-70">∞</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expiry control */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Timer className="h-4 w-4 text-muted" />
            {expiry === 0 ? 'Hosted forever' : 'Auto-delete after'}
          </div>
          <div className="relative flex rounded-xl bg-surface-2 p-1">
            {availableExpiry.map((o) => (
              <button
                key={o.value}
                onClick={() => setExpiry(o.value)}
                className={`relative z-10 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition ${expiry === o.value ? 'text-accent-ink' : 'text-muted hover:text-ink'}`}
              >
                {expiry === o.value && (
                  <motion.span layoutId="expiry-pill" className="absolute inset-0 -z-10 rounded-lg bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
                )}
                {o.short}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div className="p-4 sm:p-5">
          <button
            onClick={() => inputRef.current?.click()}
            onDragEnter={() => setHover(true)}
            onDragLeave={() => setHover(false)}
            className={`group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition sm:py-14 ${
              hover ? 'border-ink bg-accent/15' : 'border-line hover:border-ink/40 hover:bg-surface-2/60'
            }`}
          >
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
            <motion.div
              whileHover={{ y: -4, rotate: -4 }}
              className="relative mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-ink text-bg shadow-lg transition group-hover:bg-accent group-hover:text-accent-ink"
            >
              <CloudUpload className="h-7 w-7" />
            </motion.div>
            <p className="relative font-display text-2xl font-bold tracking-tight">Drop files anywhere</p>
            <p className="relative mt-1.5 text-sm text-muted">
              or <span className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4">browse</span> · paste with{' '}
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[11px]">Ctrl V</kbd>
            </p>
            <p className="relative mt-4 font-mono text-[11px] uppercase tracking-widest text-muted">Up to 100 MB per file · multiple files</p>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) enqueue(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSnippet((s) => ({ ...s, open: !s.open }))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold transition hover:bg-surface-2"
            >
              <Type className="h-3.5 w-3.5" /> Text snippet
            </button>
            <button
              onClick={async () => {
                try {
                  const items = await navigator.clipboard.read();
                  const out: File[] = [];
                  for (const it of items) {
                    const type = it.types.find((t) => t.startsWith('image/'));
                    if (type) {
                      const blob = await it.getType(type);
                      out.push(new File([blob], `clipboard-${Date.now()}.${type.split('/')[1]}`, { type }));
                    }
                  }
                  if (out.length) enqueue(out);
                  else toast({ tone: 'info', title: 'No image in clipboard', desc: 'Copy an image or press Ctrl V on the page' });
                } catch {
                  toast({ tone: 'info', title: 'Clipboard access blocked', desc: 'Press Ctrl V anywhere on the page instead' });
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold transition hover:bg-surface-2"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste image
            </button>
            <label className="ml-auto inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-muted">
              <Recycle className="h-3.5 w-3.5" />
              Smart dedupe
              <span className={`relative h-5 w-9 rounded-full transition ${dedupe ? 'bg-ink' : 'bg-surface-2 ring-1 ring-line'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${dedupe ? 'left-[18px] bg-accent' : 'left-0.5 bg-muted'}`} />
              </span>
              <input type="checkbox" className="sr-only" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
            </label>
          </div>

          <AnimatePresence>
            {snippet.open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 rounded-2xl border border-line bg-bg p-3">
                  <input
                    value={snippet.name}
                    onChange={(e) => setSnippet((s) => ({ ...s, name: e.target.value }))}
                    className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-ink"
                    placeholder="filename.txt"
                  />
                  <textarea
                    value={snippet.text}
                    onChange={(e) => setSnippet((s) => ({ ...s, text: e.target.value }))}
                    rows={5}
                    placeholder="Paste code, notes, logs…"
                    className="scrollbar-thin w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-ink"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted">{formatBytes(new Blob([snippet.text]).size)}</span>
                    <button
                      disabled={!snippet.text.trim()}
                      onClick={submitSnippet}
                      className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
                    >
                      Upload snippet
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="border-t border-line">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
              <div className="min-w-0 font-mono text-[11px] uppercase tracking-wider text-muted">
                {busy ? (
                  <span>
                    {inflight.length} in flight · {formatBytes(totalSpeed)}/s · {Math.round(overall)}%
                  </span>
                ) : (
                  <span>Queue · {queue.length} item{queue.length > 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="flex gap-1">
                {busy && (
                  <button onClick={cancelAll} className="rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10">
                    Cancel all
                  </button>
                )}
                <button onClick={clearFinished} className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                  Clear finished
                </button>
              </div>
            </div>
            {busy && (
              <div className="mx-4 mb-2 h-1 overflow-hidden rounded-full bg-surface-2 sm:mx-5">
                <motion.div className="h-full bg-accent" animate={{ width: `${overall}%` }} transition={{ ease: 'linear' }} />
              </div>
            )}
            <ul className="scrollbar-thin max-h-80 overflow-y-auto px-2 pb-2 sm:px-3">
              <AnimatePresence initial={false}>
                {queue.map((q) => {
                  const pct = q.size ? Math.min(100, (q.loaded / q.size) * 100) : 0;
                  const eta = q.speed > 0 ? (q.size - q.loaded) / q.speed : 0;
                  return (
                    <motion.li
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2/60"
                    >
                      <FileBadge category={categoryOf(q.file.type || '', q.name)} name={q.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{q.name}</p>
                          {q.reused && <span className="shrink-0 rounded bg-surface-2 px-1.5 font-mono text-[10px] text-muted">reused</span>}
                          <span className="shrink-0 rounded bg-surface-2 px-1.5 font-mono text-[10px] text-muted">{PROVIDERS[q.provider].name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted">
                          {q.status === 'uploading' && (
                            <span>
                              {formatBytes(q.loaded)} / {formatBytes(q.size)} · {formatBytes(q.speed)}/s · ETA {formatEta(eta)}
                            </span>
                          )}
                          {q.status === 'preparing' && <span>Hashing & generating preview…</span>}
                          {q.status === 'queued' && <span>Waiting · {formatBytes(q.size)}</span>}
                          {q.status === 'done' && <span className="text-ok">Uploaded · {formatBytes(q.size)}</span>}
                          {q.status === 'canceled' && <span>Canceled</span>}
                          {q.status === 'error' && <span className="truncate text-danger">{q.error}</span>}
                        </div>
                        {(q.status === 'uploading' || q.status === 'preparing') && (
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={`h-full rounded-full bg-ink transition-[width] duration-200 dark:bg-accent ${q.status === 'preparing' ? 'w-1/4 animate-pulse' : ''}`}
                              style={q.status === 'uploading' ? { width: `${pct}%` } : undefined}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {(q.status === 'uploading' || q.status === 'preparing') && (
                          <span className="mr-1 font-mono text-xs font-semibold tabular-nums">
                            {q.status === 'uploading' ? `${Math.round(pct)}%` : <LoaderCircle className="h-4 w-4 animate-spin" />}
                          </span>
                        )}
                        {q.status === 'done' && (
                          <>
                            <IconBtn label="Copy link" onClick={() => copyLink(q)}>
                              <Copy className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn label="Open details" onClick={() => q.fileId && onOpenFile(q.fileId)}>
                              <FolderOpen className="h-4 w-4" />
                            </IconBtn>
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-ok/15 text-ok">
                              <Check className="h-4 w-4" />
                            </span>
                          </>
                        )}
                        {(q.status === 'error' || q.status === 'canceled') && q.size > 0 && q.size <= MAX_SIZE && (
                          <IconBtn label="Retry" onClick={() => retry(q)}>
                            <RotateCcw className="h-4 w-4" />
                          </IconBtn>
                        )}
                        {(q.status === 'queued' || q.status === 'uploading' || q.status === 'preparing') && (
                          <IconBtn label="Cancel" onClick={() => cancel(q)}>
                            <Ban className="h-4 w-4" />
                          </IconBtn>
                        )}
                        {(q.status === 'error' || q.status === 'canceled' || q.status === 'done') && (
                          <IconBtn label="Dismiss" onClick={() => setQueue((all) => all.filter((x) => x.id !== q.id))}>
                            <X className="h-4 w-4" />
                          </IconBtn>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-2.5 font-mono text-[11px] text-muted sm:px-5">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" />
          SHA-256 fingerprinted locally · history lives only in this browser
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink">
      {children}
    </button>
  );
}
