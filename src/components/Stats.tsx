import { Activity, Flame, HardDrive, Layers } from 'lucide-react';
import { useFiles } from '../lib/store';
import { useNow } from '../lib/hooks';
import { CATEGORY_LABEL, formatBytes, statusOf } from '../lib/format';
import { CATEGORIES } from '../lib/types';
import { CAT_BG } from './FileVisual';

export default function Stats() {
  const { files } = useFiles();
  const now = useNow(5000);
  const active = files.filter((f) => statusOf(f, now) !== 'expired');
  const expiring = files.filter((f) => statusOf(f, now) === 'expiring');
  const bytes = files.reduce((s, f) => s + f.size, 0);
  const activeBytes = active.reduce((s, f) => s + f.size, 0);
  const byCat = CATEGORIES.map((c) => ({ c, bytes: files.filter((f) => f.category === c).reduce((s, f) => s + f.size, 0), n: files.filter((f) => f.category === c).length })).filter((x) => x.n > 0);

  const cards = [
    { icon: Layers, label: 'Tracked files', value: String(files.length), sub: `${active.length} live links` },
    { icon: Activity, label: 'Live storage', value: formatBytes(activeBytes), sub: 'currently hosted' },
    { icon: HardDrive, label: 'Total shipped', value: formatBytes(bytes), sub: 'all-time in this browser' },
    { icon: Flame, label: 'Expiring < 1h', value: String(expiring.length), sub: expiring.length ? 'grab them soon' : 'nothing urgent', hot: expiring.length > 0 },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
              <c.icon className={`h-3.5 w-3.5 ${c.hot ? 'text-warn' : ''}`} />
              {c.label}
            </div>
            <p className={`mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl ${c.hot ? 'text-warn' : ''}`}>{c.value}</p>
            <p className="mt-1 text-xs text-muted">{c.sub}</p>
          </div>
        ))}
      </div>
      {byCat.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            {byCat.map((x) => (
              <div key={x.c} className={`${CAT_BG[x.c]} h-full`} style={{ width: `${bytes ? Math.max(1.5, (x.bytes / bytes) * 100) : 0}%` }} title={`${CATEGORY_LABEL[x.c]} · ${formatBytes(x.bytes)}`} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {byCat.map((x) => (
              <span key={x.c} className="flex items-center gap-1.5 text-xs text-muted">
                <span className={`h-2 w-2 rounded-full ${CAT_BG[x.c]}`} />
                <span className="font-medium text-ink">{CATEGORY_LABEL[x.c]}</span> {x.n} · {formatBytes(x.bytes)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
