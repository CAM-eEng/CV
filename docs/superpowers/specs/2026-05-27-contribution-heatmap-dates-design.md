# Contribution Heatmap Dates Spec

- **Date:** 2026-05-27
- **Owner:** Cameron Hartman (`CAM-eEng`)
- **Status:** Draft, pending user review
- **Related:** `docs/superpowers/plans/2026-05-11-cv-activity-visualizer.md` (Plan 3 that shipped the original heatmap)
- **Predecessor state:** `src/components/activity/ContributionHeatmap.tsx` renders a `viewBox`-scaled SVG of 53 weeks × 7 days. Each `<rect>` has an SVG `<title>` of `${date}: ${count} contributions`, which surfaces as the browser's native pointer tooltip. No month labels, no day-of-week labels, no keyboard affordance — keyboard users have no way to discover any cell's date. The component is mounted in `src/pages/index.astro` via `<ActivityDashboard … client:visible />`, so React state is available.

## 1. Overview

Add two date affordances to the contribution heatmap:

1. A row of month abbreviations (`Jan Feb Mar …`) above the grid, aligned to the columns where each new month begins.
2. A styled hover/focus tooltip showing `"May 27, 2026 · 3 contributions"`, replacing the native `<title>`-only behavior. Cells become keyboard-focusable so the tooltip is reachable without a pointer.

Single PR. One file modified (`ContributionHeatmap.tsx`), one test file added.

## 2. Goals & non-goals

### Goals

- Make the heatmap legible at a glance — a viewer should immediately know what time range the grid covers without hovering anything.
- Replace the native browser tooltip (inconsistent styling, slow ~500ms appear delay, hidden on mobile) with an in-page tooltip that matches the dashboard's neutral aesthetic.
- Keep the `<title>` element on each cell as the accessible-name fallback for screen readers.
- Add keyboard reachability — every cell focusable, tooltip surfaces on focus as well as hover, Esc dismisses.
- No layout shift: month labels live inside the existing `<svg>` so the responsive `viewBox` scaling keeps them aligned at every width.

### Non-goals

- Day-of-week labels on the left side (Mon/Wed/Fri). Out of scope per the brainstorming session.
- A visible date-range string near the heading. Out of scope per the brainstorming session.
- A less/more legend strip. Out of scope per the brainstorming session.
- Theming changes — the tooltip uses the existing `neutral-*` Tailwind palette like the rest of the dashboard. No `--cv-*` overrides needed.
- Any change to data shape (`Activity['contributions']['days']`) or to `refresh-activity.ts`.

## 3. Behavior changes

| Surface | Before | After |
|---|---|---|
| Above the grid | Nothing | Thin row of month abbreviations (`Jan`, `Feb`, …) at the columns where each new month starts |
| Hover a cell | Native browser tooltip `2026-05-27: 3 contributions`, ~500ms appear delay, browser-styled | Instant styled tooltip `May 27, 2026 · 3 contributions` rendered as an HTML overlay above the SVG |
| Focus a cell with keyboard | Not possible — `<rect>` is not focusable | Cell is `tabIndex={0}`, gets a 1px focus ring, surfaces the styled tooltip same as hover |
| Esc while a cell is focused/hovered | n/a | Dismisses the styled tooltip; focus stays on the cell |
| Screen reader on a cell | Reads the `<title>` text | Same — `<title>` is preserved as the accessible name |

## 4. Implementation

### Month labels (inside the existing SVG)

The current SVG has `viewBox="0 0 ${WEEKS * (CELL + GAP)} ${ROWS * (CELL + GAP)}"`. Bump the height by one label row's worth of space (`LABEL_H = 14`) and translate the existing cells down by `LABEL_H`. Render the labels in the freed top band.

Algorithm:

```ts
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const monthLabels: Array<{ x: number; label: string }> = [];
let lastMonth = -1;
for (let w = 0; w < WEEKS; w++) {
  // The label anchors at the first day of the week (row 0) for column `w`.
  const cur = new Date(start);
  cur.setDate(start.getDate() + w * 7);
  const m = cur.getMonth();
  if (m !== lastMonth) {
    // Skip the very first column if it's a partial week of the previous month,
    // OR if the label would clip the left edge — let the next column take it.
    if (w === 0 && cur.getDate() > 7) {
      lastMonth = m;
      continue;
    }
    monthLabels.push({ x: w * (CELL + GAP), label: MONTH_NAMES[m] });
    lastMonth = m;
  }
}
```

Rendered as SVG `<text>` elements at `y={LABEL_H - 4}`:

```tsx
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
```

The `text-[9px]` keeps the labels legible at the heatmap's natural rendered size (~700px wide on desktop) without overpowering the cells. SVG scales with the parent `viewBox`, so labels stay aligned to columns at every breakpoint.

### Tooltip (HTML overlay)

Wrap the existing `<svg>` in a `relative` div so an absolutely-positioned HTML tooltip can sit above it:

```tsx
const [hovered, setHovered] = useState<{ x: number; y: number; date: string; count: number } | null>(null);
const wrapperRef = useRef<HTMLDivElement>(null);

// Esc dismisses
useEffect(() => {
  if (!hovered) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHovered(null); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [hovered]);
```

Each `<rect>` gets:

```tsx
<rect
  …existing props…
  tabIndex={0}
  className={`${BUCKET_FILL[bucket(c.count, max)]} focus:outline-none focus:stroke-neutral-700 dark:focus:stroke-neutral-300`}
  onMouseEnter={() => setHovered({ x: c.x, y: c.y, date: c.date, count: c.count })}
  onMouseLeave={() => setHovered(null)}
  onFocus={() => setHovered({ x: c.x, y: c.y, date: c.date, count: c.count })}
  onBlur={() => setHovered(null)}
>
  <title>{`${c.date}: ${c.count} contributions`}</title>
</rect>
```

Tooltip element (rendered only when `hovered`):

```tsx
{hovered && (
  <div
    role="tooltip"
    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-neutral-100 shadow-md dark:bg-neutral-100 dark:text-neutral-900"
    style={{
      left: `${tooltipPxLeft(hovered.x)}px`,
      top: `${tooltipPxTop(hovered.y)}px`,
    }}
  >
    {formatTooltip(hovered.date, hovered.count)}
  </div>
)}
```

`tooltipPxLeft` / `tooltipPxTop` convert from SVG viewBox coordinates to rendered pixels by reading the wrapper's `getBoundingClientRect()` width and the SVG's intrinsic viewBox width (computed constants). Clamp the left position so the tooltip doesn't overflow the wrapper's right edge: `Math.min(rawLeft, wrapperWidth - tooltipWidth - 4)` and symmetrically on the left side.

Tooltip content via a small helper:

```ts
function formatTooltip(isoDate: string, count: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const plural = count === 1 ? 'contribution' : 'contributions';
  return `${dateStr} · ${count} ${plural}`;
}
```

`timeZone: 'UTC'` is required — without it, an `en-US` locale viewer west of UTC would see "May 26" for a `2026-05-27` cell because `new Date('2026-05-27')` is parsed as UTC midnight and then localized.

### Future viewport for the SVG

```tsx
<svg
  viewBox={`0 0 ${WEEKS * (CELL + GAP)} ${ROWS * (CELL + GAP) + LABEL_H}`}
  …
>
  {/* labels at top */}
  {monthLabels.map(…)}
  {/* cells translated down by LABEL_H */}
  <g transform={`translate(0, ${LABEL_H})`}>
    {cells.map(…)}
  </g>
</svg>
```

The `<g transform>` keeps cell coordinate math (`x = w * (CELL + GAP)`, `y = d * (CELL + GAP)`) unchanged.

## 5. Test plan

### Unit tests — new file `tests/unit/contribution-heatmap.test.tsx`

Render the component with a small fixed `days` array (e.g. 60 days spanning two month boundaries). The project's existing scaffold (`vitest.config.ts` → `environment: 'jsdom'`, includes `**/*.test.tsx`, with React component tests already present such as `tests/unit/connect-bar.test.tsx` and `tests/unit/theme-toggle.test.tsx`) covers this without changes.

- `it('renders month abbreviations above the grid', ...)` — assert at least two distinct `<text>` elements with month names from `MONTH_NAMES` are present
- `it('shows a styled tooltip on cell hover', ...)` — fire `mouseEnter` on a cell, assert a `[role="tooltip"]` element appears with text matching `/[A-Z][a-z]+ \d+, \d{4} · \d+ contributions?/`
- `it('shows the tooltip on cell focus', ...)` — fire `focus` on a cell, assert tooltip appears
- `it('dismisses tooltip on Escape', ...)` — focus a cell, assert tooltip, dispatch `keydown` with `key: 'Escape'`, assert tooltip gone
- `it('preserves the <title> for screen readers', ...)` — assert every `<rect>` has a child `<title>` with `${date}: ${count} contributions`
- `it('pluralizes correctly', ...)` — `formatTooltip('2026-01-01', 1)` ends in `"1 contribution"`; `formatTooltip('2026-01-01', 3)` ends in `"3 contributions"`

### E2E test — extend `tests/e2e/`

Add one assertion to whichever existing spec exercises the homepage activity dashboard (or add `tests/e2e/contribution-heatmap.spec.ts` if none does):
- Navigate to `/`, scroll the heatmap into view, hover a cell with at least one contribution, assert the styled tooltip is visible with the expected text format.

### Tests to verify unaffected

- All other `tests/**/*.ts` — heatmap data shape is unchanged, refresh script is untouched, dashboard markup outside the heatmap is unchanged.

### Test count delta

- Added: ~7 tests (6 unit + 1 E2E)
- Removed: 0

## 6. Risks

| Risk | Mitigation |
|---|---|
| Tooltip clips at the right edge of the heatmap on narrow viewports | Clamp `left` to `wrapperWidth - tooltipWidth - 4` |
| Month label collides with the leftmost cells when the first column is mid-month | Skip the label for column 0 when `cur.getDate() > 7`; the next month's column will own that label |
| Focus ring on `<rect>` looks wrong against light cells | Use `stroke` on focus rather than `outline` — SVG-native, contrasts on both fills |
| jsdom doesn't measure SVG / `getBoundingClientRect` returns zeros, breaking tooltip positioning in tests | Tooltip positioning is presentation only; unit tests assert presence + content, not coordinates. E2E tests run in a real browser where measurement works |
| `client:visible` mounts the component late; users mid-scroll see no tooltip until hydration | Acceptable; `<title>` fallback is rendered immediately as part of the initial SVG and works in browsers without JS |
| Date locale parsing drift across timezones | `formatTooltip` forces `timeZone: 'UTC'` to match how the data was serialized |

## 7. Out-of-scope follow-ups

- Day-of-week labels (Mon/Wed/Fri) on the left side. Requires another column of label width and another alignment pass; worth doing only if the next visual review flags the heatmap as hard to orient row-wise.
- Visible "May 28 2025 — May 27 2026" range string near the heading. Adds redundancy with the month labels; revisit if user testing shows the labels alone don't convey the span.
- Less/more legend strip. The 5-bucket green ramp is fairly self-explanatory; add a legend only if data shows users misinterpreting it.
- Replace the native browser tooltip on **other** dashboard components (LanguagesDonut, FreshnessTimeline, HtbStatsCard) with the same styled-tooltip pattern. If this change goes well, extract the tooltip into a shared `<DashboardTooltip>` and apply across the board in a follow-up.
