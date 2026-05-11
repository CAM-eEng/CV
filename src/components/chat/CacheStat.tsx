export function CacheStat({ tokens }: { tokens: number }) {
  if (!tokens) return null;
  return (
    <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5">
      cached · {tokens.toLocaleString()} tokens
    </span>
  );
}
