import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

/* ---------------- Theme ---------------- */
type Theme = 'light' | 'dark';
interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const s = localStorage.getItem('ferry.theme');
    if (s === 'light' || s === 'dark') return s;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ferry.theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('useTheme outside provider');
  return c;
}

/* ---------------- Toasts ---------------- */
type Tone = 'ok' | 'err' | 'info';
interface Toast {
  id: number;
  title: string;
  desc?: string;
  tone: Tone;
}
const ToastContext = createContext<((t: Omit<Toast, 'id'>) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);
  const Icon = { ok: CircleCheck, err: TriangleAlert, info: Info };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-5 sm:translate-x-0">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const I = Icon[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 pr-3 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.45)] backdrop-blur"
              >
                <I
                  className={`mt-0.5 h-5 w-5 shrink-0 ${t.tone === 'ok' ? 'text-ok' : t.tone === 'err' ? 'text-danger' : 'text-ink'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  {t.desc && <p className="mt-0.5 truncate text-xs text-muted">{t.desc}</p>}
                </div>
                <button
                  onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
                  className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error('useToast outside provider');
  return c;
}
