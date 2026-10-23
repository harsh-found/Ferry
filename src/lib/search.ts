import type { Category, TrackedFile } from './types';
import { extOf, statusOf } from './format';

export interface ParsedQuery {
  terms: string[];
  types: string[];
  tags: string[];
  exts: string[];
  is: string[];
  minSize?: number;
  maxSize?: number;
}

const UNIT: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

const TYPE_ALIASES: Record<string, Category> = {
  img: 'image', image: 'image', images: 'image', photo: 'image', pic: 'image',
  video: 'video', vid: 'video', movie: 'video',
  audio: 'audio', music: 'audio', sound: 'audio',
  doc: 'document', docs: 'document', document: 'document', pdf: 'document',
  zip: 'archive', archive: 'archive', archives: 'archive',
  code: 'code', src: 'code',
  other: 'other',
};

export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { terms: [], types: [], tags: [], exts: [], is: [] };
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const op = /^(type|tag|ext|is):(.+)$/.exec(t);
    if (op) {
      const [, key, val] = op;
      if (key === 'type') out.types.push(TYPE_ALIASES[val] ?? val);
      if (key === 'tag') out.tags.push(val.replace(/^#/, ''));
      if (key === 'ext') out.exts.push(val.replace(/^\./, ''));
      if (key === 'is') out.is.push(val);
      continue;
    }
    const size = /^([<>])(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/.exec(t);
    if (size) {
      const bytes = parseFloat(size[2]) * UNIT[size[3] ?? 'mb'];
      if (size[1] === '>') out.minSize = bytes;
      else out.maxSize = bytes;
      continue;
    }
    if (t.startsWith('#') && t.length > 1) {
      out.tags.push(t.slice(1));
      continue;
    }
    out.terms.push(t);
  }
  return out;
}

export function isQueryEmpty(p: ParsedQuery) {
  return !p.terms.length && !p.types.length && !p.tags.length && !p.exts.length && !p.is.length && p.minSize == null && p.maxSize == null;
}

/** Returns a relevance score (>0 = match, 0 = no match). */
export function scoreFile(f: TrackedFile, p: ParsedQuery, now: number): number {
  if (p.types.length && !p.types.includes(f.category)) return 0;
  if (p.exts.length && !p.exts.includes(extOf(f.name))) return 0;
  if (p.tags.length && !p.tags.every((t) => f.tags.some((ft) => ft.toLowerCase().includes(t)))) return 0;
  if (p.minSize != null && f.size < p.minSize) return 0;
  if (p.maxSize != null && f.size > p.maxSize) return 0;
  for (const flag of p.is) {
    const st = statusOf(f, now);
    if (flag === 'pinned' && !f.pinned) return 0;
    if (flag === 'active' && st === 'expired') return 0;
    if (flag === 'expired' && st !== 'expired') return 0;
    if (flag === 'expiring' && st !== 'expiring') return 0;
    if (flag === 'noted' && !f.note.trim()) return 0;
  }
  if (!p.terms.length) return 1;
  const name = (f.label || f.name).toLowerCase();
  const orig = f.name.toLowerCase();
  const hay = [name, orig, f.note.toLowerCase(), f.tags.join(' ').toLowerCase(), f.mime, f.url.toLowerCase(), f.sha256 ?? '', f.category].join(' \u0001 ');
  let score = 0;
  for (const term of p.terms) {
    if (name.startsWith(term)) score += 12;
    else if (name.includes(term)) score += 8;
    else if (orig.includes(term)) score += 6;
    else if (f.tags.some((t) => t.toLowerCase().includes(term))) score += 5;
    else if (hay.includes(term)) score += 2;
    else if (fuzzy(name, term)) score += 1;
    else return 0;
  }
  return score;
}

function fuzzy(hay: string, needle: string): boolean {
  if (needle.length < 3) return false;
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}
