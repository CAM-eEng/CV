interface Props {
  score: number;
}

export function ScoreGauge({ score }: Props) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  return (
    <div
      className="relative w-24 h-24"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="stroke-neutral-200 dark:stroke-neutral-800"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          className={`${color} transition-[stroke-dashoffset] duration-500`}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{score}</span>
      </div>
    </div>
  );
}
