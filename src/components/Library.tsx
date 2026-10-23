import { useMemo, useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight, Check, ChevronDown, Copy, Download, Ellipsis, FileUp, Inbox, LayoutGrid, List, Pin, Search, SearchX, Trash2, X, Eraser, SquareCheck,
} from 'lucide-react';
import { useFiles } from '../lib/store';
import { useNow } from '../lib/hooks';
import { useToast } from '../lib/ui';
import { CATEGORIES, type Category, type TrackedFile } from '../lib/types';
import { CATEGORY_LABEL, copyText, downloadBlob, formatBytes, formatCountdown, formatDate, relativeTime, statusOf } from '../lib/format';
import { isQueryEmpty, parseQuery, scoreFile } from '../lib/search';
import { ExpiryBar, FileBadge, FileThumb, Highlight } from './FileVisual';

type SortKey = 'newest' | 'oldest' | 'expiring' | 'largest' | 'smallest' | 'name' | 'relevance';
type StatusFilter = 'all' | 'active' | 'expiring' | 'expired' | 'pinned' | 'forever';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Best match' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'expiring', label: 'Expiring soonest' },
  { key: 'largest', label: 'Largest' },
  { key: 'smallest', label: 'Smallest' },
  { key: 'name', label: 'Name A–Z' },
];

const HINTS = ['type:image', 'is:pinned', 'is:expiring', 'tag:work', '>10mb', 'ext:pdf'];

export default function Library({ onOpen, onUploadClick }: { onOpen: (id: string) => void; onUploadClick: () => void }) {
  const { files, update, remove, importFiles, clearExpired } = useFiles();
  const toast = useToast();
  const now = useNow(1000);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('ferry.view') as 'grid' | 'list') || 'grid');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => localStorage.setItem('ferry.view', view), [view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !(t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        e.preventDefault();
        searchRef.current?.focus();
        document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const parsed = useMemo(() => parseQuery(query), [query]);
  const hasQuery = !isQueryEmpty(parsed);
  const effectiveSort: SortKey = sort === 'relevance' && !parsed.terms.length ? 'newest' : sort;

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: files.length };
    for (const c of CATEGORIES) m[c] = files.filter((f) => f.category === c).length;
    return m;
  }, [files]);

  const visible = useMemo(() => {
    const scored: { f: TrackedFile; s: number }[] = [];
    for (const f of files) {
      if (cat !== 'all' && f.category !== cat) continue;
      const st = statusOf(f, now);
      if (status === 'active' && (st === 'expired' || f.expiry === 0)) continue;
      if (status === 'expiring' && st !== 'expiring') continue;
      if (status === 'expired' && st !== 'expired') continue;
      if (status === 'pinned' && !f.pinned) continue;
      if (status === 'forever' && f.expiry !== 0) continue;
      const s = scoreFile(f, parsed, now);
      if (s > 0) scored.push({ f, s });
    }
    const cmp: Record<SortKey, (a: { f: TrackedFile; s: number }, b: { f: TrackedFile; s: number }) => number> = {
      relevance: (a, b) => b.s - a.s || b.f.uploadedAt - a.f.uploadedAt,
      newest: (a, b) => b.f.uploadedAt - a.f.uploadedAt,
      oldest: (a, b) => a.f.uploadedAt - b.f.uploadedAt,
      expiring: (a, b) => {
        const ea = a.f.expiresAt <= now ? Infinity : a.f.expiresAt;
        const eb = b.f.expiresAt <= now ? Infinity : b.f.expiresAt;
        return ea - eb;
      },
      largest: (a, b) => b.f.size - a.f.size,
      smallest: (a, b) => a.f.size - b.f.size,
      name: (a, b) => (a.f.label || a.f.name).localeCompare(b.f.label || b.f.name),
    };
    scored.sort((a, b) => Number(b.f.pinned) - Number(a.f.pinned) || cmp[effectiveSort](a, b));
    return scored.map((x) => x.f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, cat, status, parsed, effectiveSort, Math.floor(now / 15000)]);

  const selectMode = selected.size > 0;
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectedFiles = files.filter((f) => selected.has(f.id));

  const copy = async (f: TrackedFile) => {
    const ok = await copyText(f.url);
    toast(ok ? { tone: 'ok', title: 'Link copied', desc: f.url } : { tone: 'err', title: 'Copy failed' });
  };
  const copyMany = async (list: TrackedFile[]) => {
    const live = list.filter((f) => f.expiresAt > Date.now());
    if (!live.length) return toast({ tone: 'info', title: 'No live links in selection' });
    const ok = await copyText(live.map((f) => f.url).join('\n'));
    toast(ok ? { tone: 'ok', title: `${live.length} links copied` } : { tone: 'err', title: 'Copy failed' });
  };
  const exportJSON = (list: TrackedFile[]) => {
    downloadBlob(JSON.stringify({ app: 'ferry', version: 1, exportedAt: new Date().toISOString(), files: list }, null, 2), `ferry-history-${Date.now()}.json`, 'application/json');
    toast({ tone: 'ok', title: `Exported ${list.length} records`, desc: 'JSON backup downloaded' });
  };
  const exportCSV = (list: TrackedFile[]) => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ['label', 'original_name', 'url', 'size_bytes', 'type', 'uploaded_at', 'expires_at', 'tags', 'note', 'sha256', 'provider'],
      ...list.map((f) => [f.label, f.name, f.url, f.size, f.mime, new Date(f.uploadedAt).toISOString(), f.expiry === 0 ? 'forever' : new Date(f.expiresAt).toISOString(), f.tags.join(' '), f.note, f.sha256 ?? '', f.provider ?? 'tmpfiles']),
    ];
    downloadBlob(rows.map((r) => r.map(esc).join(',')).join('\n'), `ferry-history-${Date.now()}.csv`, 'text/csv');
    toast({ tone: 'ok', title: `Exported ${list.length} rows`, desc: 'CSV downloaded' });
  };
  const onImport = async (file: File) => {
    try {
      const n = importFiles(JSON.parse(await file.text()));
      toast(n ? { tone: 'ok', title: `Imported ${n} records` } : { tone: 'info', title: 'Nothing new to import' });
    } catch {
      toast({ tone: 'err', title: 'Invalid backup file' });
    }
  };

  const expiredCount = files.filter((f) => f.expiresAt <= now).length;

  return (
    <section id="library" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">02 — Library</p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Every upload, tracked.</h2>
        </div>
        <div className="relative flex items-center gap-2">
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
          <button onClick={() => setMenu((m) => !m)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold transition hover:bg-surface-2">
            <Ellipsis className="h-4 w-4" /> Manage
          </button>
          <AnimatePresence>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
                  <MenuItem icon={Download} label="Export all as JSON" onClick={() => { exportJSON(files); setMenu(false); }} disabled={!files.length} />
                  <MenuItem icon={Download} label="Export all as CSV" onClick={() => { exportCSV(files); setMenu(false); }} disabled={!files.length} />
                  <MenuItem icon={FileUp} label="Import JSON backup" onClick={() => { importRef.current?.click(); setMenu(false); }} />
                  <div className="my-1 h-px bg-line" />
                  <MenuItem icon={Eraser} label={`Clear expired (${expiredCount})`} disabled={!expiredCount} onClick={() => { const n = clearExpired(); toast({ tone: 'ok', title: `Removed ${n} expired records` }); setMenu(false); }} />
                  <MenuItem icon={SquareCheck} label="Select all visible" disabled={!visible.length} onClick={() => { setSelected(new Set(visible.map((f) => f.id))); setMenu(false); }} />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-16 z-20 -mx-4 border-y border-line/70 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value && sort === 'newest' && parseQuery(e.target.value).terms.length) setSort('relevance');
              }}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="Search name, tag, note, hash…  try type:image >5mb"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-20 text-sm outline-none transition placeholder:text-muted/80 focus:border-ink focus:ring-4 focus:ring-accent/30"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {query ? (
                <button onClick={() => setQuery('')} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">/</kbd>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="h-11 appearance-none rounded-xl border border-line bg-surface pl-3 pr-8 text-sm font-medium outline-none focus:border-ink">
                <option value="all">All status</option>
                <option value="active">Live</option>
                <option value="expiring">Expiring &lt; 1h</option>
                <option value="expired">Expired</option>
                <option value="forever">Forever</option>
                <option value="pinned">Pinned</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            <div className="relative flex-1 lg:flex-none">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-11 w-full appearance-none rounded-xl border border-line bg-surface pl-3 pr-8 text-sm font-medium outline-none focus:border-ink">
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            <div className="flex h-11 rounded-xl border border-line bg-surface p-1">
              {(['grid', 'list'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} className={`grid w-9 place-items-center rounded-lg transition ${view === v ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>
                  {v === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto">
          {(['all', ...CATEGORIES] as const).map((c) => {
            const n = counts[c] ?? 0;
            if (c !== 'all' && n === 0) return null;
            return (
              <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${cat === c ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:border-ink/40 hover:text-ink'}`}>
                {c === 'all' ? 'All' : CATEGORY_LABEL[c]} <span className="ml-0.5 font-mono opacity-60">{n}</span>
              </button>
            );
          })}
          <span className="mx-1 h-4 w-px shrink-0 bg-line" />
          {HINTS.map((h) => (
            <button key={h} onClick={() => setQuery((q) => (q.includes(h) ? q : `${q} ${h}`.trim()))} className="shrink-0 rounded-full px-2 py-1 font-mono text-[11px] text-muted transition hover:bg-surface-2 hover:text-ink">
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* Result meta */}
      <div className="mb-4 mt-5 flex items-center justify-between text-xs text-muted">
        <span className="font-mono">
          {visible.length} of {files.length} file{files.length === 1 ? '' : 's'}
          {hasQuery && ` matching “${query.trim()}”`}
        </span>
        {(hasQuery || cat !== 'all' || status !== 'all') && (
          <button onClick={() => { setQuery(''); setCat('all'); setStatus('all'); }} className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4">
            Reset filters
          </button>
        )}
      </div>

      {/* Content */}
      {files.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-surface/50 px-6 py-20 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2">
            <Inbox className="h-7 w-7 text-muted" />
          </div>
          <p className="mt-5 font-display text-2xl font-bold">Your library is empty</p>
          <p className="mt-1 max-w-sm text-sm text-muted">Uploads are tracked automatically in this browser — with live countdowns, tags, notes and QR codes.</p>
          <button onClick={onUploadClick} className="mt-6 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90">
            Upload your first file
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-line px-6 py-16 text-center">
          <SearchX className="h-8 w-8 text-muted" />
          <p className="mt-4 font-display text-xl font-bold">No files match</p>
          <p className="mt-1 text-sm text-muted">Try a different term or clear the filters.</p>
        </div>
      ) : view === 'grid' ? (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {visible.map((f) => (
              <GridCard key={f.id} f={f} now={now} terms={parsed.terms} selected={selected.has(f.id)} selectMode={selectMode} onSelect={() => toggleSel(f.id)} onOpen={() => (selectMode ? toggleSel(f.id) : onOpen(f.id))} onCopy={() => copy(f)} onPin={() => update(f.id, { pinned: !f.pinned })} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[auto_1fr_110px_150px_140px_auto] items-center gap-4 border-b border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted md:grid">
            <span className="w-5" />
            <span>Name</span>
            <span>Size</span>
            <span>Uploaded</span>
            <span>Expires</span>
            <span className="w-24 text-right">Actions</span>
          </div>
          <AnimatePresence initial={false}>
            {visible.map((f) => (
              <ListRow key={f.id} f={f} now={now} terms={parsed.terms} selected={selected.has(f.id)} onSelect={() => toggleSel(f.id)} onOpen={() => (selectMode ? toggleSel(f.id) : onOpen(f.id))} onCopy={() => copy(f)} onPin={() => update(f.id, { pinned: !f.pinned })} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Bulk bar */}
      <AnimatePresence>
        {selectMode && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(94vw,640px)] flex-wrap items-center gap-2 rounded-2xl border border-line bg-ink p-2 pl-4 text-bg shadow-2xl">
            <span className="font-mono text-xs font-semibold">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <BulkBtn onClick={() => copyMany(selectedFiles)} icon={Copy} label="Copy links" />
              <BulkBtn onClick={() => exportJSON(selectedFiles)} icon={Download} label="JSON" />
              <BulkBtn onClick={() => exportCSV(selectedFiles)} icon={Download} label="CSV" />
              {confirmDel ? (
                <button onClick={() => { remove([...selected]); toast({ tone: 'ok', title: `Removed ${selected.size} from history` }); setSelected(new Set()); setConfirmDel(false); }} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white">
                  Confirm remove
                </button>
              ) : (
                <BulkBtn onClick={() => setConfirmDel(true)} icon={Trash2} label="Remove" />
              )}
              <button onClick={() => { setSelected(new Set()); setConfirmDel(false); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bg/15" aria-label="Clear selection">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled }: { icon: typeof Copy; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40">
      <Icon className="h-4 w-4 text-muted" /> {label}
    </button>
  );
}

function BulkBtn({ icon: Icon, label, onClick }: { icon: typeof Copy; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:bg-bg/15">
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function StatusPill({ f, now }: { f: TrackedFile; now: number }) {
  const st = statusOf(f, now);
  const left = f.expiresAt - now;
  const cls = st === 'expired' ? 'bg-surface-2 text-muted' : st === 'expiring' ? 'bg-warn/15 text-warn' : 'bg-ok/12 text-ok';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${st === 'expired' ? 'bg-muted' : st === 'expiring' ? 'animate-pulse bg-warn' : 'bg-ok'}`} />
      {formatCountdown(left)}
    </span>
  );
}

interface CardProps {
  f: TrackedFile;
  now: number;
  terms: string[];
  selected: boolean;
  selectMode?: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onCopy: () => void;
  onPin: () => void;
}

function SelectBox({ selected, onSelect, className = '' }: { selected: boolean; onSelect: () => void; className?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      aria-label={selected ? 'Deselect' : 'Select'}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${selected ? 'border-ink bg-accent text-accent-ink' : 'border-line bg-surface/90 text-transparent hover:border-ink/50'} ${className}`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}

function GridCard({ f, now, terms, selected, selectMode, onSelect, onOpen, onCopy, onPin }: CardProps) {
  const expired = f.expiresAt <= now;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.2 }}
      onClick={onOpen}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.5)] ${selected ? 'border-ink ring-2 ring-accent' : 'border-line hover:border-ink/25'} ${expired ? 'opacity-70' : ''}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-surface-2">
        <FileThumb file={f} className={`transition duration-500 group-hover:scale-105 ${expired ? 'grayscale' : ''}`} />
        <SelectBox selected={selected} onSelect={onSelect} className={`absolute left-3 top-3 ${selectMode || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          aria-label={f.pinned ? 'Unpin' : 'Pin'}
          className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg backdrop-blur transition ${f.pinned ? 'bg-accent text-accent-ink' : 'bg-surface/80 text-muted opacity-0 hover:text-ink group-hover:opacity-100'}`}
        >
          <Pin className="h-4 w-4" fill={f.pinned ? 'currentColor' : 'none'} />
        </button>
        <div className="absolute bottom-3 left-3">
          <StatusPill f={f} now={now} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold" title={f.label}>
          <Highlight text={f.label || f.name} terms={terms} />
        </h3>
        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <span>{formatBytes(f.size)}</span>·<span>{relativeTime(f.uploadedAt, now)}</span>
        </p>
        {f.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {f.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">#<Highlight text={t} terms={terms} /></span>
            ))}
            {f.tags.length > 3 && <span className="px-1 font-mono text-[10px] text-muted">+{f.tags.length - 3}</span>}
          </div>
        )}
        <div className="mt-3">
          <ExpiryBar file={f} now={now} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            disabled={expired}
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink py-2 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-30"
          >
            <Copy className="h-3.5 w-3.5" /> Copy link
          </button>
          <a
            href={expired ? undefined : f.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-disabled={expired}
            className={`grid w-10 place-items-center rounded-xl border border-line transition hover:bg-surface-2 ${expired ? 'pointer-events-none opacity-30' : ''}`}
            aria-label="Open"
          >
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </motion.article>
  );
}

function ListRow({ f, now, terms, selected, onSelect, onOpen, onCopy, onPin }: CardProps) {
  const expired = f.expiresAt <= now;
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      onClick={onOpen}
      className={`group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 transition md:grid-cols-[auto_1fr_110px_150px_140px_auto] md:gap-4 ${selected ? 'bg-accent/10' : 'hover:bg-surface-2/60'} ${expired ? 'opacity-60' : ''}`}
    >
      <SelectBox selected={selected} onSelect={onSelect} />
      <div className="flex min-w-0 items-center gap-3">
        {f.thumb ? (
          <img src={f.thumb} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-line object-cover" />
        ) : (
          <FileBadge category={f.category} name={f.name} size="sm" />
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {f.pinned && <Pin className="h-3 w-3 shrink-0 text-ink" fill="currentColor" />}
            <span className="truncate"><Highlight text={f.label || f.name} terms={terms} /></span>
          </p>
          <p className="truncate font-mono text-[11px] text-muted md:hidden">
            {formatBytes(f.size)} · {formatCountdown(f.expiresAt - now)}
          </p>
          {f.tags.length > 0 && <p className="hidden truncate font-mono text-[10px] text-muted md:block">{f.tags.map((t) => `#${t}`).join(' ')}</p>}
        </div>
      </div>
      <span className="hidden font-mono text-xs text-muted md:block">{formatBytes(f.size)}</span>
      <span className="hidden font-mono text-xs text-muted md:block">{formatDate(f.uploadedAt)}</span>
      <span className="hidden md:block"><StatusPill f={f} now={now} /></span>
      <div className="flex w-auto items-center justify-end gap-0.5 md:w-24">
        <RowBtn label={f.pinned ? 'Unpin' : 'Pin'} onClick={onPin}><Pin className="h-4 w-4" fill={f.pinned ? 'currentColor' : 'none'} /></RowBtn>
        <RowBtn label="Copy link" onClick={onCopy} disabled={expired}><Copy className="h-4 w-4" /></RowBtn>
        <a href={expired ? undefined : f.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`hidden h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink sm:grid ${expired ? 'pointer-events-none opacity-30' : ''}`} aria-label="Open">
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </motion.div>
  );
}

function RowBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} title={label} aria-label={label} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}
