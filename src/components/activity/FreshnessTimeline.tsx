import type { Activity } from '~/lib/activity/schema';

interface Props {
  freshness: Activity['freshness'];
}

function monthsAgo(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, 1);
  const now = new Date();
  return (now.getFullYear() - target.getFullYear()) * 12 + (now.getMonth() - target.getMonth());
}

export function FreshnessTimeline({ freshness }: Props) {
  if (!freshness.length) return null;
  const MAX_MONTHS = 24;

  const byCategory = new Map<string, typeof freshness>();
  for (const f of freshness) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }

  return (
    <div className="space-y-4">
      {[...byCategory.entries()].map(([category, items]) => (
        <section key={category}>
          <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{category}</h4>
          <ul className="space-y-1.5">
            {items.map((f) => {
              const months = monthsAgo(f.lastUsed);
              const ratio = Math.max(0, Math.min(1, 1 - months / MAX_MONTHS));
              const widthPct = Math.max(8, ratio * 100);
              const fresh = months <= 3;
              return (
                <li key={f.name} className="text-xs flex items-center gap-3">
                  <span className="w-32 truncate font-mono">{f.name}</span>
                  <div className="flex-1 bg-neutral-100 dark:bg-neutral-900 rounded h-2 overflow-hidden">
                    <div
                      className={`h-full ${fresh ? 'bg-green-500' : ratio > 0.4 ? 'bg-amber-500' : 'bg-neutral-400 dark:bg-neutral-700'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-16 tabular-nums text-neutral-500 text-right">
                    {f.lastUsed}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
