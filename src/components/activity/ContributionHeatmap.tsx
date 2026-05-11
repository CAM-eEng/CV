import type { Activity } from '~/lib/activity/schema';

interface Props {
  days: Activity['contributions']['days'];
}

const CELL = 11;
const GAP = 3;
const ROWS = 7;
const WEEKS = 53;

function bucket(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const ratio = count / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

const BUCKET_FILL = [
  'fill-neutral-200 dark:fill-neutral-800',
  'fill-green-200 dark:fill-green-900',
  'fill-green-400 dark:fill-green-700',
  'fill-green-500 dark:fill-green-500',
  'fill-green-600 dark:fill-green-400',
];

export function ContributionHeatmap({ days }: Props) {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const max = Math.max(1, ...days.map((d) => d.count));

  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(end.getDate() - WEEKS * 7 + 1);

  const cells: Array<{ x: number; y: number; count: number; date: string }> = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < ROWS; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      const date = cur.toISOString().slice(0, 10);
      cells.push({ x: w * (CELL + GAP), y: d * (CELL + GAP), count: byDate.get(date) ?? 0, date });
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WEEKS * (CELL + GAP)} ${ROWS * (CELL + GAP)}`}
        role="img"
        aria-label="GitHub contributions over the last year"
        className="w-full"
      >
        {cells.map((c) => (
          <rect
            key={c.date}
            x={c.x}
            y={c.y}
            width={CELL}
            height={CELL}
            rx={2}
            className={BUCKET_FILL[bucket(c.count, max)]}
          >
            <title>{`${c.date}: ${c.count} contributions`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
