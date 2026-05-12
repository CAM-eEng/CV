export type Stored = 'light' | 'dark' | 'matrix' | 'system';
export type Mode = 'light' | 'dark';
export type Palette = 'default' | 'matrix';
export type Resolved = { mode: Mode; palette: Palette };

export const STORAGE_KEY = 'cv.theme';
const VALID: readonly Stored[] = ['light', 'dark', 'matrix', 'system'];

export function resolveTheme(stored: Stored, prefersDark: boolean): Resolved {
  if (stored === 'matrix') return { mode: 'dark', palette: 'matrix' };
  if (stored === 'dark') return { mode: 'dark', palette: 'default' };
  if (stored === 'light') return { mode: 'light', palette: 'default' };
  return { mode: prefersDark ? 'dark' : 'light', palette: 'default' };
}

export function applyTheme(resolved: Resolved, html: HTMLElement): void {
  if (resolved.mode === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');

  if (resolved.palette === 'matrix') html.setAttribute('data-theme', 'matrix');
  else html.removeAttribute('data-theme');
}

export function getStoredTheme(): Stored {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return (VALID as readonly string[]).includes(v ?? '') ? (v as Stored) : 'system';
  } catch {
    return 'system';
  }
}

export function setStoredTheme(v: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* private mode / blocked — ignore */
  }
}
