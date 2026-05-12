import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (v: Stored) => {
    setStored(v);
    setStoredTheme(v);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(resolveTheme(v, prefersDark), document.documentElement);
    setOpen(false);
  };

  const current = SEGMENTS.find((s) => s.value === stored) ?? SEGMENTS[3];

  return (
    <div
      ref={containerRef}
      className={[
        'fixed top-3 right-4 z-20 text-xs transition-opacity duration-200',
        open
          ? 'opacity-100'
          : 'opacity-0 hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100',
      ].join(' ')}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Color theme: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {current.icon}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Color theme"
          className="absolute right-0 mt-2 min-w-[140px] rounded-md border border-neutral-200 bg-white p-1 shadow-md dark:border-neutral-800 dark:bg-neutral-900"
        >
          {SEGMENTS.map((seg) => {
            const active = stored === seg.value;
            return (
              <button
                key={seg.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                aria-label={seg.label}
                onClick={() => choose(seg.value)}
                className={[
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left',
                  active
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                ].join(' ')}
              >
                {seg.icon}
                <span>{seg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
