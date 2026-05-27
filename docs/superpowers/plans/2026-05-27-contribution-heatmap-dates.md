# Contribution Heatmap Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add month labels above the GitHub contribution heatmap and replace the native `<title>` tooltip with a styled hover/focus tooltip — keeping `<title>` as a screen-reader fallback.

**Architecture:** Two pure helpers (`formatTooltip`, `computeMonthLabels`) live in `ContributionHeatmap.tsx` and are unit-tested in isolation. The component renders month labels as SVG `<text>` inside the existing `viewBox` (so they scale with the grid), and uses React `useState` to drive an absolutely-positioned HTML tooltip overlay above the SVG. Cells become `tabIndex={0}` so the tooltip is keyboard-reachable. `<title>` is preserved on every `<rect>` for AT users.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + jsdom + `@testing-library/react`, Playwright for E2E.

**Spec reference:** `docs/superpowers/specs/2026-05-27-contribution-heatmap-dates-design.md`

---

## File structure

```
src/components/activity/ContributionHeatmap.tsx    # MODIFY — add helpers, month labels, tooltip
tests/unit/contribution-heatmap.test.tsx            # CREATE — helpers + rendering tests
tests/e2e/activity-dashboard.spec.ts                # MODIFY — add tooltip-on-hover assertion
```

Three files touched. Helpers are co-located with the component (matches the single-file-per-component pattern already in `src/components/activity/`).

---

## Task 1: TDD the `formatTooltip` helper

**Files:**
- Modify: `src/components/activity/ContributionHeatmap.tsx`
- Create: `tests/unit/contribution-heatmap.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/contribution-heatmap.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- contribution-heatmap`
Expected: FAIL with `formatTooltip is not exported` (or similar import error).

- [ ] **Step 3: Add the helper**

Add to `src/components/activity/ContributionHeatmap.tsx`, near the top (after the imports, before `bucket`):

```tsx
export function formatTooltip(isoDate: string, count: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const plural = count === 1 ? 'contribution' : 'contributions';
  return `${dateStr} · ${count} ${plural}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- contribution-heatmap`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/activity/ContributionHeatmap.tsx tests/unit/contribution-heatmap.test.tsx
git commit -m "$(cat <<'EOF'
feat(heatmap): add formatTooltip helper

Pure helper that turns ISO date + count into the styled-tooltip string.
Forces timeZone UTC so western-timezone viewers don't see an off-by-one
day for a date that was serialized as YYYY-MM-DD.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: TDD the `computeMonthLabels` helper

**Files:**
- Modify: `src/components/activity/ContributionHeatmap.tsx`
- Modify: `tests/unit/contribution-heatmap.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/contribution-heatmap.test.tsx`:

```tsx
import { computeMonthLabels } from '~/components/activity/ContributionHeatmap';

describe('computeMonthLabels', () => {
  it('emits one label per month, anchored at the column where the month begins', () => {
    // 53 weeks ending on Saturday 2026-05-30 (so start = 2025-05-25, a Sunday).
    // The grid spans late May 2025 → late May 2026.
    const end = new Date('2026-05-30T00:00:00Z');
    const start = new Date('2025-05-25T00:00:00Z');
    const labels = computeMonthLabels(start, 53);

    // First column: Sunday 2025-05-25 → that week contains May 25-31, so the
    // Sunday is in May but the rest is partly in June. computeMonthLabels
    // anchors on the Sunday, so column 0 is "May", and the next label is "Jun".
    // We expect roughly 12 labels for a 53-week span.
    expect(labels.length).toBeGreaterThanOrEqual(11);
    expect(labels.length).toBeLessThanOrEqual(13);

    const names = labels.map((l) => l.label);
    // All 12 distinct month names should appear at least once across a year.
    for (const m of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) {
      expect(names).toContain(m);
    }

    // Labels are in column order (x strictly increasing).
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].x).toBeGreaterThan(labels[i - 1].x);
    }
  });

  it('skips a column-0 label when its week falls mostly in the previous month', () => {
    // Start on Sunday 2025-05-25 — the week is mostly May (25-31), with the
    // first June day landing on the next column. We want "May" labelled on
    // column 0 (Sunday is May 25 → month is May, date is 25 > 7 means the
    // Sunday is late in its month; skip the label, let June take its column).
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- contribution-heatmap`
Expected: FAIL with `computeMonthLabels is not exported`.

- [ ] **Step 3: Add the helper**

Add to `src/components/activity/ContributionHeatmap.tsx`, after `formatTooltip`:

```tsx
const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
];

export interface MonthLabel {
  x: number;
  label: string;
}

export function computeMonthLabels(start: Date, weeks: number): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const cur = new Date(start);
    cur.setUTCDate(start.getUTCDate() + w * 7);
    const m = cur.getUTCMonth();
    if (m !== lastMonth) {
      // Skip the column-0 label if its Sunday is late in its month — the next
      // column will own the new-month label and the leftover days from the
      // prior month are visually a partial week.
      if (w === 0 && cur.getUTCDate() > 7) {
        lastMonth = m;
        continue;
      }
      labels.push({ x: w * (CELL + GAP), label: MONTH_NAMES[m] });
      lastMonth = m;
    }
  }
  return labels;
}
```

`CELL` and `GAP` already exist as module constants at the top of the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- contribution-heatmap`
Expected: 7/7 PASS (4 from Task 1 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/activity/ContributionHeatmap.tsx tests/unit/contribution-heatmap.test.tsx
git commit -m "$(cat <<'EOF'
feat(heatmap): add computeMonthLabels helper

Pure helper that walks the grid's weeks and emits one MonthLabel per
month at the x-coordinate of the column where the new month begins.
Skips a column-0 label when its Sunday is mid-month, since rendering
"May" at x=0 for a week mostly composed of May 25-31 looks misaligned
once "Jun" lands one column to the right.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Render month labels in the SVG

**Files:**
- Modify: `src/components/activity/ContributionHeatmap.tsx`
- Modify: `tests/unit/contribution-heatmap.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/contribution-heatmap.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { ContributionHeatmap } from '~/components/activity/ContributionHeatmap';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- contribution-heatmap`
Expected: FAIL — current viewBox height is `7 * 14 = 98`, no `<text>` elements rendered yet.

- [ ] **Step 3: Update the SVG to reserve label space and render labels**

Replace the bottom of `src/components/activity/ContributionHeatmap.tsx` (from `export function ContributionHeatmap`) with:

```tsx
const LABEL_H = 14;

export function ContributionHeatmap({ days }: Props) {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const max = Math.max(1, ...days.map((d) => d.count));

  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(end.getDate() - WEEKS * 7 + 1);

  const monthLabels = computeMonthLabels(start, WEEKS);

  const cells: Array<{ x: number; y: number; count: number; date: string }> = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < ROWS; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      const date = cur.toISOString().slice(0, 10);
      cells.push({ x: w * (CELL + GAP), y: d * (CELL + GAP), count: byDate.get(date) ?? 0, date });
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WEEKS * (CELL + GAP)} ${ROWS * (CELL + GAP) + LABEL_H}`}
        role="img"
        aria-label="GitHub contributions over the last year"
        className="w-full"
      >
        {monthLabels.map((l) => (
          <text
            key={`${l.x}-${l.label}`}
            x={l.x}
            y={LABEL_H - 4}
            className="fill-neutral-500 text-[9px] font-medium"
          >
            {l.label}
          </text>
        ))}
        <g transform={`translate(0, ${LABEL_H})`}>
          {cells.map((c) => (
            <rect
              key={c.date}
              x={c.x}
              y={c.y}
              width={CELL}
              height={CELL}
              rx={2}
              className={BUCKET_FILL[bucket(c.count, max)]}
            >
              <title>{`${c.date}: ${c.count} contributions`}</title>
            </rect>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- contribution-heatmap`
Expected: 9/9 PASS (7 prior + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/activity/ContributionHeatmap.tsx tests/unit/contribution-heatmap.test.tsx
git commit -m "$(cat <<'EOF'
feat(heatmap): render month labels above the grid

Reserves LABEL_H=14 px at the top of the SVG viewBox and renders the
output of computeMonthLabels as <text> elements there. Cells are
wrapped in a <g transform> to shift down by the label band's height
so their existing coordinate math (x = w*(CELL+GAP), y = d*(CELL+GAP))
stays unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add focusable cells + styled tooltip

**Files:**
- Modify: `src/components/activity/ContributionHeatmap.tsx`
- Modify: `tests/unit/contribution-heatmap.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/contribution-heatmap.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- contribution-heatmap`
Expected: 5 new tests FAIL — no `tabIndex` on cells, no `role="tooltip"` element rendered.

- [ ] **Step 3: Add the tooltip state, handlers, and overlay**

Replace `src/components/activity/ContributionHeatmap.tsx`'s import line and component body:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Activity } from '~/lib/activity/schema';
```

Inside `ContributionHeatmap`, after the existing `cells` construction and before the `return`:

```tsx
  const [hovered, setHovered] = useState<{ x: number; y: number; date: string; count: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hovered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHovered(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hovered]);

  const svgVbWidth = WEEKS * (CELL + GAP);
  const tooltipLeftPct =
    hovered === null
      ? 0
      : Math.min(
          Math.max(((hovered.x + CELL / 2) / svgVbWidth) * 100, 8),
          92,
        );
  const tooltipTopPx =
    hovered === null ? 0 : ((hovered.y + LABEL_H) / (ROWS * (CELL + GAP) + LABEL_H)) * 100;
```

Replace the `return (…)` block with:

```tsx
  return (
    <div ref={wrapperRef} className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgVbWidth} ${ROWS * (CELL + GAP) + LABEL_H}`}
        role="img"
        aria-label="GitHub contributions over the last year"
        className="w-full"
      >
        {monthLabels.map((l) => (
          <text
            key={`${l.x}-${l.label}`}
            x={l.x}
            y={LABEL_H - 4}
            className="fill-neutral-500 text-[9px] font-medium"
          >
            {l.label}
          </text>
        ))}
        <g transform={`translate(0, ${LABEL_H})`}>
          {cells.map((c) => (
            <rect
              key={c.date}
              x={c.x}
              y={c.y}
              width={CELL}
              height={CELL}
              rx={2}
              tabIndex={0}
              className={`${BUCKET_FILL[bucket(c.count, max)]} focus:outline-none focus:stroke-neutral-700 dark:focus:stroke-neutral-300`}
              onMouseEnter={() => setHovered({ x: c.x, y: c.y, date: c.date, count: c.count })}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered({ x: c.x, y: c.y, date: c.date, count: c.count })}
              onBlur={() => setHovered(null)}
            >
              <title>{`${c.date}: ${c.count} contributions`}</title>
            </rect>
          ))}
        </g>
      </svg>
      {hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-neutral-100 shadow-md dark:bg-neutral-100 dark:text-neutral-900"
          style={{
            left: `${tooltipLeftPct}%`,
            top: `${tooltipTopPx}%`,
          }}
        >
          {formatTooltip(hovered.date, hovered.count)}
        </div>
      )}
    </div>
  );
```

Note: positioning uses percent of the wrapper rather than pixel measurement of the SVG, so it works in jsdom (where `getBoundingClientRect` returns zeros) and in real browsers (where the wrapper has a real width). The 8–92% horizontal clamp keeps the tooltip from clipping the heatmap's edges.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- contribution-heatmap`
Expected: 14/14 PASS (9 prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/activity/ContributionHeatmap.tsx tests/unit/contribution-heatmap.test.tsx
git commit -m "$(cat <<'EOF'
feat(heatmap): focusable cells with styled hover/focus tooltip

Cells become tabIndex={0} so keyboard users can reach them. Hover and
focus surface a styled HTML tooltip overlay above the SVG showing
"Month Day, Year · N contributions". Esc dismisses. The <title>
element stays on every <rect> as the screen-reader-accessible name —
this replaces only the pointer/keyboard UX, not the AT path.

Tooltip is positioned with percent-of-wrapper math rather than
getBoundingClientRect, so it works in jsdom unit tests as well as
real browsers. A 8-92% horizontal clamp prevents edge clipping.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: E2E assertion for the tooltip

**Files:**
- Modify: `tests/e2e/activity-dashboard.spec.ts`

- [ ] **Step 1: Write the new E2E test**

Append to `tests/e2e/activity-dashboard.spec.ts`:

```ts
test('shows a styled tooltip when hovering a contribution cell', async ({ page }) => {
  await page.goto('/');
  // Wait for the heatmap to hydrate (client:visible on the dashboard).
  const heatmap = page.getByRole('img', { name: /GitHub contributions over the last year/i });
  await heatmap.scrollIntoViewIfNeeded();
  await expect(heatmap).toBeVisible();

  // Hover the first focusable cell; the styled tooltip should appear.
  const firstCell = heatmap.locator('rect[tabindex="0"]').first();
  await firstCell.hover();

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText(
    /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4} · \d+ contributions?$/,
  );
});
```

- [ ] **Step 2: Build the site so Playwright's `bun run preview` has fresh artifacts**

Run: `bun run build`
Expected: clean build, no errors.

- [ ] **Step 3: Run the E2E suite for this file**

Run: `bun run test:e2e -- activity-dashboard`
Expected: both tests PASS (the pre-existing empty/recent assertion and the new tooltip assertion).

If the test fails because `activity.json` shape was empty in this checkout, refresh first: `GH_API_TOKEN=… GH_LOGIN=CAM-eEng bun run refresh-activity`. (Locally, the committed `data/activity.json` should already have real data.)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/activity-dashboard.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): heatmap shows styled tooltip on cell hover

Hovers the first focusable cell on the homepage's contribution heatmap
and asserts the tooltip overlay appears with the expected
"Month Day, Year · N contributions" text shape.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Full verification, lint, PR

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `bun run lint`
Expected: clean — both ESLint and Prettier report no issues. If Prettier reports formatting drift in `ContributionHeatmap.tsx` or the new test file, run `bun run format` and re-lint.

- [ ] **Step 2: Type-check + build**

Run: `bun run build`
Expected: `astro check` reports no TypeScript errors; build artifacts written to `dist/`.

- [ ] **Step 3: Full unit + integration suite**

Run: `bun run test`
Expected: all suites PASS — the 14 new heatmap tests plus everything pre-existing. No regressions in `activity-loader`, `activity-schema`, `activity-freshness`, or other dashboard-adjacent tests.

- [ ] **Step 4: Full E2E suite**

Run: `bun run test:e2e`
Expected: all specs PASS, including the new `activity-dashboard` assertion.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create \
  --title "feat(heatmap): month labels + styled hover/focus tooltip" \
  --body "$(cat <<'EOF'
## Summary
- Adds month abbreviations above the GitHub contribution heatmap (SVG `<text>` inside the existing `viewBox`, scales with the grid)
- Replaces the native browser `<title>` tooltip with a styled hover/focus tooltip that shows "Month Day, Year · N contributions"
- Cells become `tabIndex={0}` so the tooltip is keyboard-reachable; `<title>` is preserved on every cell for screen readers
- Esc dismisses the tooltip

Spec: `docs/superpowers/specs/2026-05-27-contribution-heatmap-dates-design.md`
Plan: `docs/superpowers/plans/2026-05-27-contribution-heatmap-dates.md`

## Test plan
- [x] Unit: `formatTooltip` (4 cases — pluralization, UTC handling)
- [x] Unit: `computeMonthLabels` (3 cases — column ordering, column-0 skip, column-0 emit)
- [x] Unit: month labels render in the SVG with reserved viewBox space
- [x] Unit: tooltip appears on hover, hides on mouseleave, appears on focus, dismisses on Escape, `<title>` preserved
- [x] E2E: hovering a cell on `/` surfaces the styled tooltip with the expected text shape
- [x] `bun run lint`, `bun run build`, `bun run test`, `bun run test:e2e` all clean
EOF
)"
```

- [ ] **Step 6: Watch CI**

Run: `gh pr checks --watch`
Expected: `build-and-test` goes green.

---

## Self-review

- ✅ Spec coverage:
  - "Month labels above grid" → Tasks 2 + 3
  - "Styled hover tooltip replacing native `<title>`" → Task 4
  - "Keep `<title>` for screen readers" → Task 4 (explicit test)
  - "Keyboard-reachable via `tabIndex={0}` + focus/blur handlers + Esc dismiss" → Task 4
  - "No layout shift / SVG-internal month labels" → Task 3 (viewBox bump + `<g transform>`)
  - "Out of scope" items (day-of-week labels, date-range string, legend) — not added; not in any task
- ✅ Placeholder scan: no TBD/TODO; every code step has complete code; every test step has the assertion explicitly written
- ✅ Type consistency: `MonthLabel` type defined once in Task 2, consumed in Task 3; `hovered` shape `{ x, y, date, count }` defined once in Task 4 and used throughout
- ✅ Tasks are bite-sized — each step is one action with explicit code, run command, and expected outcome
- ✅ TDD throughout — failing test before implementation in Tasks 1, 2, 3, 4
- ✅ Frequent commits — one per task (5 commits + a final no-code PR-open commit message)
