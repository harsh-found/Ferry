import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { FileStoreProvider, useFiles } from './lib/store';
import { ThemeProvider, ToastProvider } from './lib/ui';
import { useNow } from './lib/hooks';
import Header from './components/Header';
import UploadPanel from './components/UploadPanel';
import Stats from './components/Stats';
import Library from './components/Library';
import FileDrawer from './components/FileDrawer';
import CommandPalette from './components/CommandPalette';
import HowItWorks from './components/HowItWorks';

const TICKER = ['No login', 'Up to 100 MB', 'Auto-delete 1h → forever', 'Live countdowns', 'SHA-256 fingerprints', 'QR codes', 'Tags & notes', 'Instant search', 'Export / import', 'Multiple hosts'];

function Shell() {
  const { files } = useFiles();
  const now = useNow(10000);
  const [openId, setOpenId] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const pickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openFile = useCallback((id: string) => setOpenId(id), []);
  const closeFile = useCallback(() => setOpenId(null), []);
  const upload = useCallback(() => {
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
    pickRef.current?.();
  }, []);
  const activeCount = files.filter((f) => f.expiresAt > now).length;

  return (
    <div id="top" className="min-h-screen">
      <Header onPalette={() => setPalette(true)} activeCount={activeCount} />

      <main>
        {/* Hero */}
        <section id="upload" className="relative overflow-hidden">
          <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-accent/25 blur-[120px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">
            <div>
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
                </span>
                01 — Anonymous file drop
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.6 }}
                className="mt-6 font-display text-[3.2rem] font-extrabold leading-[0.92] tracking-[-0.04em] sm:text-7xl xl:text-[5.6rem]"
              >
                Drop it.
                <br />
                Share it.
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">Track it.</span>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.55, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                    className="absolute inset-x-[-0.08em] bottom-[0.08em] z-0 h-[0.36em] origin-left rounded-sm bg-accent"
                  />
                </span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Upload files up to <strong className="text-ink">100 MB</strong> without an account, set when they self-destruct, and keep a searchable, tagged history of every link — right in your browser.
              </motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-8 flex flex-wrap items-center gap-3">
                <button onClick={upload} className="rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-bg transition hover:-translate-y-0.5 hover:shadow-lg">
                  Choose files
                </button>
                <a href="#library" className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold transition hover:bg-surface">
                  My library {files.length > 0 && <span className="font-mono text-xs text-muted">({files.length})</span>}
                  <ArrowDown className="h-4 w-4" />
                </a>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
              <UploadPanel onOpenFile={openFile} pickRef={pickRef} />
            </motion.div>
          </div>

          {/* Ticker */}
          <div className="relative overflow-hidden border-y border-line bg-ink py-3 text-bg">
            <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-10 font-display text-lg font-semibold tracking-tight">
                  {t}
                  <span className="h-2 w-2 rotate-45 bg-accent" />
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="pt-16">
          <Stats />
        </div>
        <Library onOpen={openFile} onUploadClick={upload} />
        <HowItWorks />
      </main>

      <FileDrawer id={openId} onClose={closeFile} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onOpenFile={openFile} onUpload={upload} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <FileStoreProvider>
          <Shell />
        </FileStoreProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
