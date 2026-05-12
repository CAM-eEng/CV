import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeToggle } from '~/components/ThemeToggle';
import { STORAGE_KEY } from '~/lib/theme';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('ThemeToggle', () => {
  it('renders four segments with role=radio', () => {
    render(<ThemeToggle />);
    const segs = screen.getAllByRole('radio');
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.getAttribute('aria-label') || s.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/light/i),
        expect.stringMatching(/dark/i),
        expect.stringMatching(/matrix/i),
        expect.stringMatching(/system/i),
      ]),
    );
  });

  it('defaults to System when no stored preference', () => {
    render(<ThemeToggle />);
    const sys = screen.getByRole('radio', { name: /system/i });
    expect(sys.getAttribute('aria-checked')).toBe('true');
  });

  it('reads stored preference on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'matrix');
    render(<ThemeToggle />);
    const matrix = screen.getByRole('radio', { name: /matrix/i });
    expect(matrix.getAttribute('aria-checked')).toBe('true');
  });

  it('persists and applies on click — light', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /light/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('persists and applies on click — dark', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /dark/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('persists and applies on click — matrix', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /matrix/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('matrix');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('matrix');
  });

  it('persists and applies on click — system resolves to light when OS prefers light', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /system/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
