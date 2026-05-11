import type { Activity } from '~/lib/activity/schema';

const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#facc15'];

interface Props {
  languages: Activity['languages'];
}

export function LanguagesDonut({ languages }: Props) {
  const top = languages.slice(0, 6);
  const total = top.reduce((sum, l) => sum + l.bytes, 0) || 1;
  const radius = 36;
  const stroke = 12;
  const circ = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = top.map((l, i) => {
    const frac = l.bytes / total;
    const arc = {
      ...l,
      color: COLORS[i % COLORS.length],
      dashOffset: offset,
      dashArray: circ * frac,
    };
    offset += circ * frac;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
        <circle
          cx={40}
          cy={40}
          r={radius}
          stroke="rgba(0,0,0,.08)"
          strokeWidth={stroke}
          fill="none"
        />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={40}
            cy={40}
            r={radius}
            stroke={a.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${a.dashArray} ${circ - a.dashArray}`}
            strokeDashoffset={-a.dashOffset}
          />
        ))}
      </svg>
      <ul className="text-xs space-y-1">
        {arcs.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: a.color }} />
            <span className="font-mono">{a.name}</span>
            <span className="text-neutral-500">{((a.bytes / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
