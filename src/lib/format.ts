import type { Category, TrackedFile } from './types';

export const MAX_SIZE = 100 * 1024 * 1024;

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : v >= 100 ? 0 : digits)} ${units[i]}`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  if (ms >= 315360000000) return 'Forever';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${Math.ceil(seconds % 60)}s`;
}

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.round((ts - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  if (i <= 0 || i === name.length - 1) return '';
  return name.slice(i + 1).toLowerCase();
}

const CODE_EXT = ['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'cpp', 'h', 'cs', 'php', 'html', 'css', 'scss', 'json', 'xml', 'yml', 'yaml', 'sh', 'sql', 'md', 'toml', 'swift', 'dart', 'vue', 'svelte'];
const ARCHIVE_EXT = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'dmg', 'apk'];
const DOC_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'csv', 'epub', 'pages', 'key', 'numbers'];

export function categoryOf(mime: string, name: string): Category {
  const ext = extOf(name);
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (CODE_EXT.includes(ext)) return 'code';
  if (ARCHIVE_EXT.includes(ext) || /zip|compressed|tar|rar/.test(mime)) return 'archive';
  if (DOC_EXT.includes(ext) || mime === 'application/pdf' || mime.startsWith('text/')) return 'document';
  return 'other';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  document: 'Docs',
  archive: 'Archives',
  code: 'Code',
  other: 'Other',
};

/** tmpfiles.org rejects names with <2 char base or no extension — normalise safely. */
export function safeUploadName(name: string): string {
  const ext = extOf(name);
  const baseRaw = ext ? name.slice(0, name.length - ext.length - 1) : name;
  let base = baseRaw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  if (base.length < 2) base = `file-${base || 'upload'}`;
  const safeExt = (ext || 'bin').replace(/[^a-z0-9]/g, '') || 'bin';
  return `${base.slice(0, 120)}.${safeExt}`;
}

export type StatusKey = 'active' | 'expiring' | 'expired';

export function statusOf(f: TrackedFile, now: number): StatusKey {
  if (f.expiry === 0) return 'active';
  const left = f.expiresAt - now;
  if (left <= 0) return 'expired';
  if (left <= 60 * 60 * 1000) return 'expiring';
  return 'active';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

export function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
