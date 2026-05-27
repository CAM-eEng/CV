import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { formatTooltip } from '~/components/activity/ContributionHeatmap';

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
