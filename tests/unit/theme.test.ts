import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveTheme,
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  STORAGE_KEY,
  type Stored,
} from '~/lib/theme';

describe('resolveTheme', () => {
  const cases: Array<[Stored, boolean, { mode: 'light' | 'dark'; palette: 'default' | 'matrix' }]> =
    [
      ['light', false, { mode: 'light', palette: 'default' }],
      ['light', true, { mode: 'light', palette: 'default' }],
      ['dark', false, { mode: 'dark', palette: 'default' }],
      ['dark', true, { mode: 'dark', palette: 'default' }],
      ['matrix', false, { mode: 'dark', palette: 'matrix' }],
      ['matrix', true, { mode: 'dark', palette: 'matrix' }],
      ['system', false, { mode: 'light', palette: 'default' }],
      ['system', true, { mode: 'dark', palette: 'default' }],
    ];

  it.each(cases)('stored=%s prefersDark=%s → %o', (stored, prefersDark, expected) => {
    expect(resolveTheme(stored, prefersDark)).toEqual(expected);
  });
});

describe('applyTheme', () => {
  let html: HTMLElement;
  beforeEach(() => {
    html = document.createElement('html');
  });

  it('adds dark class for dark mode', () => {
    applyTheme({ mode: 'dark', palette: 'default' }, html);
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.hasAttribute('data-theme')).toBe(false);
  });

  it('removes dark class for light mode', () => {
    html.classList.add('dark');
    applyTheme({ mode: 'light', palette: 'default' }, html);
    expect(html.classList.contains('dark')).toBe(false);
  });

  it('sets data-theme=matrix for matrix palette', () => {
    applyTheme({ mode: 'dark', palette: 'matrix' }, html);
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.getAttribute('data-theme')).toBe('matrix');
  });

  it('removes data-theme when palette is default', () => {
    html.setAttribute('data-theme', 'matrix');
    applyTheme({ mode: 'dark', palette: 'default' }, html);
    expect(html.hasAttribute('data-theme')).toBe(false);
  });

  it('is idempotent', () => {
    applyTheme({ mode: 'dark', palette: 'matrix' }, html);
    const before = html.outerHTML;
    applyTheme({ mode: 'dark', palette: 'matrix' }, html);
    expect(html.outerHTML).toBe(before);
  });
});

describe('getStoredTheme', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('returns "system" when localStorage is empty', () => {
    expect(getStoredTheme()).toBe('system');
  });

  it('returns stored value when valid', () => {
    localStorage.setItem(STORAGE_KEY, 'matrix');
    expect(getStoredTheme()).toBe('matrix');
  });

  it('returns "system" for unknown stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'rainbow');
    expect(getStoredTheme()).toBe('system');
  });

  it('returns "system" when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getStoredTheme()).toBe('system');
    spy.mockRestore();
  });
});

describe('setStoredTheme', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('persists the value', () => {
    setStoredTheme('matrix');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('matrix');
  });

  it('silently swallows storage failures', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setStoredTheme('matrix')).not.toThrow();
    spy.mockRestore();
  });
});
