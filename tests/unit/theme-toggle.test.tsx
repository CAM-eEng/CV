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

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: /color theme/i }));
};

describe('ThemeToggle', () => {
  it('renders a closed dropdown by default — only the trigger is visible', () => {
    render(<ThemeToggle />);
    const trigger = screen.getByRole('button', { name: /color theme/i });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
  });

  it('opens the menu on trigger click and shows four menuitemradio entries', () => {
    render(<ThemeToggle />);
    openMenu();
    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(4);
    expect(items.map((s) => s.getAttribute('aria-label'))).toEqual(
      expect.arrayContaining(['Light', 'Dark', 'Matrix', 'System']),
    );
  });

  it('defaults to System when no stored preference', () => {
    render(<ThemeToggle />);
    openMenu();
    const sys = screen.getByRole('menuitemradio', { name: /system/i });
    expect(sys.getAttribute('aria-checked')).toBe('true');
  });

  it('trigger advertises the current selection via aria-label', () => {
    localStorage.setItem(STORAGE_KEY, 'matrix');
    render(<ThemeToggle />);
    const trigger = screen.getByRole('button', { name: /color theme/i });
    expect(trigger.getAttribute('aria-label')).toMatch(/matrix/i);
  });

  it('reads stored preference on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'matrix');
    render(<ThemeToggle />);
    openMenu();
    const matrix = screen.getByRole('menuitemradio', { name: /matrix/i });
    expect(matrix.getAttribute('aria-checked')).toBe('true');
  });

  it('persists and applies on click — light', () => {
    render(<ThemeToggle />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /light/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('persists and applies on click — dark', () => {
    render(<ThemeToggle />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /dark/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('persists and applies on click — matrix', () => {
    render(<ThemeToggle />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /matrix/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('matrix');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('matrix');
  });

  it('persists and applies on click — system resolves to light when OS prefers light', () => {
    render(<ThemeToggle />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /system/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('closes the menu after a selection', () => {
    render(<ThemeToggle />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /dark/i }));
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    const trigger = screen.getByRole('button', { name: /color theme/i });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
