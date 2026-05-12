import { useEffect, useState, type ReactNode } from 'react';
import {
  type Stored,
  STORAGE_KEY,
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
} from '~/lib/theme';

const SEGMENTS: ReadonlyArray<{ value: Stored; label: string; icon: ReactNode }> = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <circle cx="8" cy="8" r="3" />
        <path
          d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <path d="M6.5 1.5A6.5 6.5 0 1 0 14.5 9.5 5 5 0 0 1 6.5 1.5Z" />
      </svg>
    ),
  },
  {
    value: 'matrix',
    label: 'Matrix',
    icon: (
      <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        <rect x="3" y="3" width="2" height="10" />
        <rect x="7" y="3" width="2" height="10" />
        <rect x="11" y="3" width="2" height="10" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <rect x="2" y="3" width="12" height="8" rx="1" />
        <path d="M6 13h4M8 11v2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const [stored, setStored] = useState<Stored>('system');

  useEffect(() => {
    const initial = getStoredTheme();
    setStored(initial);

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(resolveTheme(initial, mql.matches), document.documentElement);

    const onMql = () => {
      const current = getStoredTheme();
      if (current === 'system') {
        applyTheme(resolveTheme(current, mql.matches), document.documentElement);
      }
    };
    mql.addEventListener('change', onMql);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = getStoredTheme();
      setStored(next);
      applyTheme(resolveTheme(next, mql.matches), document.documentElement);
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mql.removeEventListener('change', onMql);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const choose = (v: Stored) => {
    setStored(v);
    setStoredTheme(v);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(resolveTheme(v, prefersDark), document.documentElement);
  };

  return (
    <fieldset
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded-md border border-neutral-200 dark:border-neutral-800 p-0.5 text-xs"
    >
      {SEGMENTS.map((seg) => {
        const active = stored === seg.value;
        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={seg.label}
            onClick={() => choose(seg.value)}
            className={[
              'inline-flex items-center gap-1 rounded px-2 py-1 transition-colors',
              active
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
            ].join(' ')}
          >
            {seg.icon}
            <span className="hidden sm:inline">{seg.label}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
