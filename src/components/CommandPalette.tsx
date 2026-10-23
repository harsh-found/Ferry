import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudUpload, CornerDownLeft, Eraser, Moon, Search, Sun, Library as LibIcon } from 'lucide-react';
import { useFiles } from '../lib/store';
import { useTheme, useToast } from '../lib/ui';
import { parseQuery, scoreFile } from '../lib/search';
import { formatBytes, formatCountdown } from '../lib/format';
import { FileBadge, Highlight } from './FileVisual';

interface Item {
  key: string;
  kind: 'action' | 'file';
  label: string;
  sub?: string;
  run: () => void;
  render?: React.ReactNode;
}

export default function CommandPalette({ open, onClose, onOpenFile, onUpload }: { open: boolean; onClose: () => void; onOpenFile: (id: string) => void; onUpload: () => void }) {
  const { files, clearExpired } = useFiles();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const now = Date.now();
    const parsed = parseQuery(q);
    const actions: Item[] = [
      { key: 'a-up', kind: 'action', label: 'Upload files', sub: 'Open file picker', run: onUpload },
      { key: 'a-lib', kind: 'action', label: 'Go to library', sub: 'Jump to your tracked files', run: () => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' }) },
      { key: 'a-theme', kind: 'action', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`, sub: 'Toggle theme', run: toggle },
      { key: 'a-clear', kind: 'action', label: 'Clear expired records', sub: 'Tidy up your history', run: () => { const n = clearExpired(); toast({ tone: 'ok', title: `Removed ${n} expired records` }); } },
    ].filter((a) => !q.trim() || a.label.toLowerCase().includes(q.trim().toLowerCase())) as Item[];
    const fileItems: Item[] = files
      .map((f) => ({ f, s: scoreFile(f, parsed, now) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.f.uploadedAt - a.f.uploadedAt)
      .slice(0, 8)
      .map(({ f }) => ({
        key: f.id,
        kind: 'file' as const,
        label: f.label || f.name,
        sub: `${formatBytes(f.size)} · ${formatCountdown(f.expiresAt - now)}`,
        run: () => onOpenFile(f.id),
        render: (
          <div className="flex min-w-0 items-center gap-3">
            {f.thumb ? <img src={f.thumb} alt="" className="h-10 w-10 rounded-xl border border-line object-cover" /> : <FileBadge category={f.category} name={f.name} size="sm" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold"><Highlight text={f.label || f.name} terms={parsed.terms} /></p>
              <p className="font-mono text-[11px] text-muted">{formatBytes(f.size)} · {formatCountdown(f.expiresAt - now)}</p>
            </div>
          </div>
        ),
      }));
    return [...fileItems, ...actions];
  }, [q, files, theme, toggle, clearExpired, onOpenFile, onUpload, toast]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const run = (it?: Item) => {
    if (!it) return;
    onClose();
    setTimeout(it.run, 60);
  };

  const icon = (k: string) => {
    if (k === 'a-up') return <CloudUpload className="h-4 w-4" />;
    if (k === 'a-lib') return <LibIcon className="h-4 w-4" />;
    if (k === 'a-theme') return theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />;
    return <Eraser className="h-4 w-4" />;
  };

  const fileCount = items.filter((i) => i.kind === 'file').length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-5 w-5 text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
                  if (e.key === 'Enter') { e.preventDefault(); run(items[idx]); }
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="Search files or type a command…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
              />
              <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
            </div>
            <div ref={listRef} className="scrollbar-thin max-h-[55vh] overflow-y-auto p-2">
              {items.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted">No results for “{q}”</p>}
              {items.map((it, i) => (
                <div key={it.key}>
                  {i === 0 && fileCount > 0 && <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted">Files</p>}
                  {i === fileCount && <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted">Actions</p>}
                  <button
                    data-idx={i}
                    onMouseMove={() => setIdx(i)}
                    onClick={() => run(it)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${i === idx ? 'bg-surface-2' : ''}`}
                  >
                    {it.render ?? (
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-bg">{icon(it.key)}</span>
                        <div>
                          <p className="text-sm font-semibold">{it.label}</p>
                          <p className="text-xs text-muted">{it.sub}</p>
                        </div>
                      </div>
                    )}
                    {i === idx && <CornerDownLeft className="h-4 w-4 shrink-0 text-muted" />}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10px] text-muted">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span className="ml-auto">operators: type: tag: is: ext: &gt;5mb</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
