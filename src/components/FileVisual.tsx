import { File, FileArchive, FileCode, FileText, Film, Image, Music } from 'lucide-react';
import type { Category, TrackedFile } from '../lib/types';
import { extOf } from '../lib/format';

export const CAT_ICON: Record<Category, typeof File> = {
  image: Image,
  video: Film,
  audio: Music,
  document: FileText,
  archive: FileArchive,
  code: FileCode,
  other: File,
};

export const CAT_TEXT: Record<Category, string> = {
  image: 'text-cat-image',
  video: 'text-cat-video',
  audio: 'text-cat-audio',
  document: 'text-cat-document',
  archive: 'text-cat-archive',
  code: 'text-cat-code',
  other: 'text-cat-other',
};

export const CAT_BG: Record<Category, string> = {
  image: 'bg-cat-image',
  video: 'bg-cat-video',
  audio: 'bg-cat-audio',
  document: 'bg-cat-document',
  archive: 'bg-cat-archive',
  code: 'bg-cat-code',
  other: 'bg-cat-other',
};

export function FileBadge({ category, name, size = 'md' }: { category: Category; name: string; size?: 'sm' | 'md' }) {
  const Icon = CAT_ICON[category];
  const ext = extOf(name) || category.slice(0, 3);
  const box = size === 'sm' ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl';
  return (
    <div className={`relative grid shrink-0 place-items-center border border-line bg-surface-2 ${box}`}>
      <Icon className={`${size === 'sm' ? 'h-4.5 w-4.5' : 'h-5 w-5'} ${CAT_TEXT[category]}`} strokeWidth={1.8} />
      <span
        className={`absolute -bottom-1.5 -right-1.5 max-w-[3.2rem] truncate rounded-md px-1 py-px font-mono text-[9px] font-semibold uppercase leading-tight text-white ${CAT_BG[category]}`}
      >
        {ext.slice(0, 5)}
      </span>
    </div>
  );
}

export function FileThumb({ file, className = '' }: { file: TrackedFile; className?: string }) {
  const Icon = CAT_ICON[file.category];
  if (file.thumb) {
    return <img src={file.thumb} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`stripes relative grid h-full w-full place-items-center ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <Icon className={`h-9 w-9 ${CAT_TEXT[file.category]}`} strokeWidth={1.4} />
        <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted">
          .{extOf(file.name) || file.category}
        </span>
      </div>
    </div>
  );
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.filter((t) => t.length > 0).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!clean.length) return <>{text}</>;
  const re = new RegExp(`(${clean.join('|')})`, 'ig');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[3px] bg-accent px-0.5 text-accent-ink">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ExpiryBar({ file, now }: { file: TrackedFile; now: number }) {
  if (file.expiry === 0) {
    return (
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-full rounded-full bg-ok" />
      </div>
    );
  }
  const total = file.expiry * 1000;
  const left = Math.max(0, file.expiresAt - now);
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const color = left <= 0 ? 'bg-muted' : left <= 3600_000 ? 'bg-warn' : 'bg-ok';
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
