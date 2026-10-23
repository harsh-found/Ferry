import { Command, Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../lib/ui';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 20.5 16 9l7 11.5" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 23.5h16" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Header({ onPalette, activeCount }: { onPalette: () => void; activeCount: number }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="font-display text-xl font-bold tracking-tight">Ferry</span>
          <span className="hidden rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted sm:inline">
            no login
          </span>
        </a>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {[
            ['#upload', 'Upload'],
            ['#library', 'Library'],
            ['#how', 'How it works'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink">
              {label}
              {href === '#library' && activeCount > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-px font-mono text-[10px] font-semibold text-accent-ink">{activeCount}</span>
              )}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onPalette}
            className="group flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-muted transition hover:border-ink/30 hover:text-ink"
          >
            <Command className="h-4 w-4" />
            <span className="hidden sm:inline">Quick search</span>
            <kbd className="hidden rounded-md border border-line bg-surface-2 px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-line bg-surface text-ink transition hover:border-ink/30"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ y: 18, rotate: -90, opacity: 0 }}
                animate={{ y: 0, rotate: 0, opacity: 1 }}
                exit={{ y: -18, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </header>
  );
}
