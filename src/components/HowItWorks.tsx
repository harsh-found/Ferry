import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Command, Fingerprint, Plus, QrCode, Search, ShieldOff, Tags, Zap } from 'lucide-react';
import { Logo } from './Header';

const FEATURES = [
  { icon: ShieldOff, title: 'Zero accounts', text: 'No sign-up, no email, no cookies to accept. Open the page and ship a file.' },
  { icon: Clock, title: 'You pick the lifespan', text: 'Auto-delete after 1h, 6h, 24h or 48h. Live countdowns show exactly how long every link has left.' },
  { icon: Search, title: 'Search that thinks', text: 'Fuzzy matching across names, tags, notes and hashes — plus operators like type:video or >20mb.' },
  { icon: Fingerprint, title: 'Smart dedupe', text: 'Every file is SHA-256 fingerprinted in your browser. Re-uploading a live file reuses its link instantly.' },
  { icon: Tags, title: 'Tags, notes & pins', text: 'Organise uploads with tags and private notes. Pin the important ones to the top.' },
  { icon: QrCode, title: 'QR & native share', text: 'Each file gets a scannable QR code and one-tap sharing on mobile.' },
  { icon: Zap, title: 'Parallel queue', text: '3 concurrent uploads with real-time speed, ETA, cancel and retry.' },
  { icon: Command, title: 'Keyboard-first', text: 'Ctrl K command palette, / to search, Ctrl V to paste screenshots straight in.' },
];

const FAQ = [
  ['Where are my files stored?', 'Files are hosted by your chosen provider — tmpfiles.org for temporary sharing or OnlyFiles for permanent hosting. Ferry itself stores nothing on a server; your upload history lives in this browser’s local storage.'],
  ['How long do files stay online?', 'You choose before uploading: 60 minutes, 6 hours, 24 hours, 48 hours — or forever when using OnlyFiles. For timed uploads, the host deletes the file automatically when the countdown ends.'],
  ['What’s the size limit?', 'Up to 100 MB per file on both providers. You can queue as many files as you like; three upload in parallel.'],
  ['Can I move my history to another device?', 'Yes. Use Manage → Export JSON, then Import JSON on the other browser. CSV export is available for spreadsheets.'],
  ['Does removing a file from history delete it?', 'No — it only removes the record from your library. The file itself remains reachable until its expiry time.'],
  ['Is it private?', 'Anyone with the link can download the file, so treat links like secrets. Avoid uploading sensitive data unencrypted.'],
];

export default function HowItWorks() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <section id="how" className="border-y border-line bg-surface/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">03 — Features</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">Small tool. Serious toolkit.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: (i % 4) * 0.06 }}
                className="group bg-surface p-6 transition hover:bg-bg"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-bg transition group-hover:border-ink group-hover:bg-accent group-hover:text-accent-ink">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">04 — FAQ</p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Good questions.</h2>
          <p className="mt-4 max-w-sm text-muted">Everything you need to know about how Ferry handles your files.</p>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
                <span className="font-display text-lg font-semibold">{q}</span>
                <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line">
                  <Plus className="h-4 w-4" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pr-12 text-sm leading-relaxed text-muted">
                    <span className="block pb-5">{a}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="font-display font-bold">Ferry</span>
            <span className="text-sm text-muted">— anonymous file drops, tracked.</span>
          </div>
          <p className="font-mono text-[11px] text-muted">Hosted on tmpfiles.org & OnlyFiles · 100 MB max · history stored locally</p>
        </div>
      </footer>
    </>
  );
}
