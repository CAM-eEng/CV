import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import {
  formatTooltip,
  computeMonthLabels,
  ContributionHeatmap,
} from '~/components/activity/ContributionHeatmap';

afterEach(() => {
  cleanup();
});

describe('formatTooltip', () => {
  it('formats a date and pluralized count', () => {
    expect(formatTooltip('2026-05-27', 3)).toBe('May 27, 2026 · 3 contributions');
  });

  it('uses singular form for exactly 1 contribution', () => {
    expect(formatTooltip('2026-01-01', 1)).toBe('January 1, 2026 · 1 contribution');
  });

  it('uses plural for 0 contributions', () => {
    expect(formatTooltip('2026-03-15', 0)).toBe('March 15, 2026 · 0 contributions');
  });

  it('treats the ISO date as UTC (no off-by-one for western timezones)', () => {
    // Without `timeZone: 'UTC'`, a viewer west of UTC would see "May 26"
    // for a "2026-05-27" cell because `new Date('2026-05-27')` parses as
    // UTC midnight and would then be localized backward.
    expect(formatTooltip('2026-05-27', 1)).toMatch(/^May 27, 2026/);
  });
});

describe('computeMonthLabels', () => {
  it('emits one label per month, anchored at the column where the month begins', () => {
    // 53 weeks ending on Saturday 2026-05-30 (so start = 2025-05-25, a Sunday).
    // The grid spans late May 2025 → late May 2026.
    const start = new Date('2025-05-25T00:00:00Z');
    const labels = computeMonthLabels(start, 53);

    // First column: Sunday 2025-05-25 → that week contains May 25-31, so the
    // Sunday is in May but the rest is partly in June. computeMonthLabels
    // anchors on the Sunday, so column 0 is "May", and the next label is "Jun".
    // We expect roughly 12 labels for a 53-week span.
    expect(labels.length).toBeGreaterThanOrEqual(12);
    expect(labels.length).toBeLessThanOrEqual(13);

    const names = labels.map((l) => l.label);
    // All 12 distinct month names should appear at least once across a year.
    for (const m of [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]) {
      expect(names).toContain(m);
    }

    // Labels are in column order (x strictly increasing).
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].x).toBeGreaterThan(labels[i - 1].x);
    }
  });

  it('skips a column-0 label when its week falls mostly in the previous month', () => {
    // Sunday 2025-05-25 is late in May (date 25 > 7), so the column-0 May
    // label is skipped. The next column (which contains June 1) takes the
    // first label slot, so labels[0] is "Jun" at x > 0.
    const start = new Date('2025-05-25T00:00:00Z');
    const labels = computeMonthLabels(start, 6);
    // First label should be "Jun" at x > 0, NOT "May" at x = 0.
    expect(labels[0].label).toBe('Jun');
    expect(labels[0].x).toBeGreaterThan(0);
  });

  it('emits a column-0 label when its Sunday is early in the month', () => {
    // Sunday 2026-03-01 — clearly the start of March; label belongs on col 0.
    const start = new Date('2026-03-01T00:00:00Z');
    const labels = computeMonthLabels(start, 4);
    expect(labels[0]).toEqual({ x: 0, label: 'Mar' });
  });
});

function makeDays(n: number): Array<{ date: string; count: number }> {
  const days: Array<{ date: string; count: number }> = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), count: i % 5 });
  }
  return days;
}

describe('<ContributionHeatmap /> tooltip', () => {
  it('shows a styled tooltip on cell hover', () => {
    const { container } = render(<ContributionHeatmap days={makeDays(30)} />);
    const rect = container.querySelector('rect[tabindex="0"]')!;
    fireEvent.mouseEnter(rect);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toMatch(/[A-Z][a-z]+ \d+, \d{4} · \d+ contributions?/);
  });

  it('hides the tooltip on mouse leave', () => {
    const { container } = render(<ContributionHeatmap days={makeDays(30)} />);
    const rect = container.querySelector('rect[tabindex="0"]')!;
    fireEvent.mouseEnter(rect);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(rect);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip on cell focus', () => {
    const { container } = render(<ContributionHeatmap days={makeDays(30)} />);
    const rect = container.querySelector('rect[tabindex="0"]')!;
    fireEvent.focus(rect);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('dismisses the tooltip on Escape', () => {
    const { container } = render(<ContributionHeatmap days={makeDays(30)} />);
    const rect = container.querySelector('rect[tabindex="0"]')!;
    fireEvent.focus(rect);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('preserves the <title> element on every cell for screen readers', () => {
    const { container } = render(<ContributionHeatmap days={makeDays(30)} />);
    const rects = container.querySelectorAll('rect[tabindex="0"]');
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) {
      const title = r.querySelector('title');
      expect(title).not.toBeNull();
      expect(title!.textContent).toMatch(/^\d{4}-\d{2}-\d{2}: \d+ contributions$/);
    }
  });
});

describe('<ContributionHeatmap /> month labels', () => {
  it('renders at least two distinct month abbreviations above the grid', () => {
    const { container } = render(<ContributionHeatmap days={makeDays(120)} />);
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent);
    const months = new Set(
      texts.filter((t) => t && /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(t)),
    );
    expect(months.size).toBeGreaterThanOrEqual(2);
  });

  it('reserves vertical space for labels in the viewBox', () => {
    const { container } = render(<ContributionHeatmap days={makeDays(7)} />);
    const svg = container.querySelector('svg')!;
    const viewBox = svg.getAttribute('viewBox')!;
    const [, , , h] = viewBox.split(' ').map(Number);
    // 7 rows * (11 + 3) = 98 for cells alone; labels add LABEL_H = 14.
    expect(h).toBe(7 * (11 + 3) + 14);
  });
});
