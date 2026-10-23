import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TrackedFile } from './types';

const KEY = 'ferry.files.v1';

function isValid(x: unknown): x is TrackedFile {
  if (!x || typeof x !== 'object') return false;
  const f = x as Record<string, unknown>;
  return typeof f.id === 'string' && typeof f.url === 'string' && typeof f.name === 'string' && typeof f.expiresAt === 'number';
}

function normalize(f: TrackedFile): TrackedFile {
  return {
    ...f,
    label: f.label ?? f.name,
    tags: Array.isArray(f.tags) ? f.tags : [],
    note: f.note ?? '',
    pinned: !!f.pinned,
    size: Number(f.size) || 0,
    mime: f.mime || 'application/octet-stream',
    category: f.category || 'other',
    provider: f.provider || 'tmpfiles',
  };
}

function load(): TrackedFile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(isValid).map(normalize) : [];
  } catch {
    return [];
  }
}

function save(files: TrackedFile[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(files));
  } catch {
    // Quota exceeded: drop thumbnails from oldest files and retry.
    const sorted = [...files].sort((a, b) => a.uploadedAt - b.uploadedAt);
    const stripped = new Set(sorted.slice(0, Math.ceil(sorted.length / 2)).map((f) => f.id));
    try {
      localStorage.setItem(KEY, JSON.stringify(files.map((f) => (stripped.has(f.id) ? { ...f, thumb: undefined } : f))));
    } catch {
      /* give up silently */
    }
  }
}

interface Store {
  files: TrackedFile[];
  add: (f: TrackedFile) => void;
  update: (id: string, patch: Partial<TrackedFile>) => void;
  remove: (ids: string[]) => void;
  importFiles: (list: unknown) => number;
  clearExpired: () => number;
}

const Ctx = createContext<Store | null>(null);


export function FileStoreProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<TrackedFile[]>(load);
  const filesRef = useRef(files);
  const skipSave = useRef(false);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    save(files);
  }, [files]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        skipSave.current = true;
        setFiles(load());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((f: TrackedFile) => setFiles((prev) => [f, ...prev]), []);
  const update = useCallback(
    (id: string, patch: Partial<TrackedFile>) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f))),
    [],
  );
  const remove = useCallback((ids: string[]) => {
    const s = new Set(ids);
    setFiles((prev) => prev.filter((f) => !s.has(f.id)));
  }, []);
  const importFiles = useCallback(
    (list: unknown) => {
      const src = Array.isArray(list) ? list : (list as { files?: unknown })?.files;
      if (!Array.isArray(src)) return 0;
      const valid = src.filter(isValid).map(normalize);
      const existing = new Set(filesRef.current.map((f) => f.url));
      const fresh = valid.filter((f) => !existing.has(f.url));
      if (fresh.length) setFiles((prev) => [...fresh, ...prev].sort((a, b) => b.uploadedAt - a.uploadedAt));
      return fresh.length;
    },
    [],
  );
  const clearExpired = useCallback(() => {
    const now = Date.now();
    const expired = filesRef.current.filter((f) => f.expiresAt <= now);
    if (expired.length) setFiles((prev) => prev.filter((f) => f.expiresAt > now));
    return expired.length;
  }, []);

  const value = useMemo(() => ({ files, add, update, remove, importFiles, clearExpired }), [files, add, update, remove, importFiles, clearExpired]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFiles(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFiles outside provider');
  return c;
}
