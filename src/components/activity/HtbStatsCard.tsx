import type { Activity } from '~/lib/activity/schema';

interface Props {
  htb: Activity['htb'];
}

export function HtbStatsCard({ htb }: Props) {
  if (!htb) return null;
  const sortedCats = Object.entries(htb.categories).sort((a, b) => b[1] - a[1]);
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded p-5 space-y-3">
      <header className="flex items-baseline justify-between">
        <h4 className="font-medium">HackTheBox</h4>
        <span className="text-xs uppercase tracking-wider text-neutral-500">{htb.rank}</span>
      </header>
      <div className="flex items-baseline gap-6">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{htb.points.toLocaleString()}</div>
          <div className="text-xs text-neutral-500">points</div>
        </div>
        <div>
          <div className="text-3xl font-semibold tabular-nums">{htb.ownedMachines}</div>
          <div className="text-xs text-neutral-500">machines owned</div>
        </div>
      </div>
      {sortedCats.length > 0 && (
        <ul className="text-xs space-y-1">
          {sortedCats.map(([cat, n]) => (
            <li key={cat} className="flex justify-between">
              <span className="font-mono">{cat}</span>
              <span className="tabular-nums text-neutral-500">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
