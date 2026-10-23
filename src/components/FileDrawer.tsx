import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import QRCode from 'qrcode';
import { ArrowUpRight, Check, Copy, Download, Hash, Infinity as InfinityIcon, Pin, Share2, StickyNote, Tag, Trash2, X } from 'lucide-react';
import { PROVIDERS } from '../lib/providers';
import { useFiles } from '../lib/store';
import { useNow } from '../lib/hooks';
import { useToast } from '../lib/ui';
import { EXPIRY_OPTIONS, type TrackedFile } from '../lib/types';
import { copyText, formatBytes, formatCountdown, formatDate, statusOf } from '../lib/format';
import { ExpiryBar, FileThumb } from './FileVisual';

export default function FileDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { files } = useFiles();
  const file = files.find((f) => f.id === id) ?? null;

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [id, onClose]);

  return (
    <AnimatePresence>
      {file && (
        <>
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="scrollbar-thin fixed inset-y-0 right-0 z-[70] w-full overflow-y-auto border-l border-line bg-bg sm:w-[480px]"
          >
            <DrawerBody file={file} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({ file, onClose }: { file: TrackedFile; onClose: () => void }) {
  const { update, remove } = useFiles();
  const toast = useToast();
  const now = useNow(1000);
  const [qr, setQr] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const expired = file.expiresAt <= now;
  const st = statusOf(file, now);

  useEffect(() => {
    QRCode.toDataURL(file.url, { margin: 1, width: 360, color: { dark: '#15140f', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [file.url]);

  const copy = async (text: string, label = 'Link copied') => {
    const ok = await copyText(text);
    toast(ok ? { tone: 'ok', title: label } : { tone: 'err', title: 'Copy failed' });
    if (ok && text === file.url) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();
    if (t && !file.tags.includes(t)) update(file.id, { tags: [...file.tags, t] });
    setTagInput('');
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: file.label, text: `${file.label} · ${formatBytes(file.size)}`, url: file.url });
      } catch {
        /* dismissed */
      }
    } else copy(file.url);
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/85 px-5 py-3.5 backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">File details</p>
        <div className="flex items-center gap-1">
          <button onClick={() => update(file.id, { pinned: !file.pinned })} className={`grid h-9 w-9 place-items-center rounded-xl transition ${file.pinned ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`} aria-label="Pin">
            <Pin className="h-4 w-4" fill={file.pinned ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-surface-2">
          <FileThumb file={file} className={expired ? 'grayscale' : ''} />
        </div>

        <div>
          <input
            value={file.label}
            onChange={(e) => update(file.id, { label: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && update(file.id, { label: file.name })}
            className="w-full rounded-lg bg-transparent font-display text-2xl font-bold tracking-tight outline-none ring-accent/40 focus:ring-4"
            aria-label="Label"
          />
          {file.label !== file.name && <p className="mt-1 truncate font-mono text-[11px] text-muted">original: {file.name}</p>}
        </div>

        {/* Countdown */}
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">{file.expiry === 0 ? 'Hosted' : expired ? 'Status' : 'Auto-deletes in'}</p>
              <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${file.expiry === 0 ? 'text-ok' : st === 'expired' ? 'text-muted' : st === 'expiring' ? 'text-warn' : ''}`}>
                {file.expiry === 0 && <InfinityIcon className="mr-2 inline h-7 w-7" />}
                {formatCountdown(file.expiresAt - now)}
              </p>
            </div>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted">
              {EXPIRY_OPTIONS.find((o) => o.value === file.expiry)?.label ?? `${file.expiry / 3600}h`} plan
            </span>
          </div>
          <div className="mt-3">
            <ExpiryBar file={file} now={now} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">
            {file.expiry === 0
              ? `Permanently hosted on ${PROVIDERS[file.provider || 'tmpfiles'].name}`
              : `${expired ? 'Deleted on' : 'Expires'} ${formatDate(file.expiresAt)}`
            }
          </p>
        </div>

        {/* Link */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Share link</p>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pl-3">
            <span className={`min-w-0 flex-1 truncate font-mono text-xs ${expired ? 'text-muted line-through' : ''}`}>{file.url}</span>
            <button disabled={expired} onClick={() => copy(file.url)} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-30">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={expired ? undefined : file.url} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-sm font-semibold transition hover:bg-surface-2 ${expired ? 'pointer-events-none opacity-30' : ''}`}>
              <ArrowUpRight className="h-4 w-4" /> Open
            </a>
            <button disabled={expired} onClick={share} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-sm font-semibold transition hover:bg-surface-2 disabled:opacity-30">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>

        {/* QR */}
        {qr && !expired && (
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <img src={qr} alt="QR code" className="h-28 w-28 rounded-xl border border-line bg-white p-1" />
            <div className="min-w-0">
              <p className="font-semibold">Scan to download</p>
              <p className="mt-1 text-xs text-muted">Point any phone camera at the code to open this file instantly.</p>
              <a href={qr} download={`${file.label || file.name}-qr.png`} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold underline decoration-accent decoration-2 underline-offset-4">
                <Download className="h-3.5 w-3.5" /> Save QR
              </a>
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted"><Tag className="h-3.5 w-3.5" /> Tags</p>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-2">
            {file.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 py-1 pl-2 pr-1 font-mono text-xs">
                #{t}
                <button onClick={() => update(file.id, { tags: file.tags.filter((x) => x !== t) })} className="rounded p-0.5 text-muted hover:text-danger" aria-label={`Remove ${t}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                } else if (e.key === 'Backspace' && !tagInput && file.tags.length) {
                  update(file.id, { tags: file.tags.slice(0, -1) });
                }
              }}
              onBlur={addTag}
              placeholder={file.tags.length ? 'Add…' : 'Add tags, press Enter'}
              className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted"><StickyNote className="h-3.5 w-3.5" /> Private note</p>
          <textarea
            value={file.note}
            onChange={(e) => update(file.id, { note: e.target.value })}
            rows={3}
            placeholder="Who is this for? What’s inside? (searchable, stays in your browser)"
            className="scrollbar-thin w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        </div>

        {/* Meta */}
        <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-sm">
          {[
            ['Size', `${formatBytes(file.size, 2)} (${file.size.toLocaleString()} bytes)`],
            ['Type', file.mime],
            ['Uploaded', formatDate(file.uploadedAt)],
            ['Host', PROVIDERS[file.provider || 'tmpfiles'].name],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="truncate text-right font-mono text-xs">{v}</dd>
            </div>
          ))}
          {file.sha256 && (
            <div className="px-4 py-2.5">
              <dt className="flex items-center justify-between text-muted">
                <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> SHA-256</span>
                <button onClick={() => copy(file.sha256!, 'Checksum copied')} className="text-xs font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4">Copy</button>
              </dt>
              <dd className="mt-1 break-all font-mono text-[11px] leading-relaxed text-muted">{file.sha256}</dd>
            </div>
          )}
        </dl>

        <div className="pb-6">
          {confirm ? (
            <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 p-2 pl-3">
              <p className="flex-1 text-xs">Remove from history? The file stays on tmpfiles until it expires.</p>
              <button onClick={() => setConfirm(false)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-surface">Cancel</button>
              <button onClick={() => { remove([file.id]); toast({ tone: 'ok', title: 'Removed from history' }); onClose(); }} className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-semibold text-white">Remove</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10">
              <Trash2 className="h-4 w-4" /> Remove from history
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
