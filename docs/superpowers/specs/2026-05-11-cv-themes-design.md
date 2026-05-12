# CV — Themes Design Spec

- **Date:** 2026-05-11
- **Owner:** Cameron Hartman (`CAM-eEng`)
- **Status:** Draft, pending user review
- **Related:** `2026-05-09-cv-design.md` §11 (visual identity, deferred); TODO.md §Visual identity
- **Predecessor state:** site uses Tailwind 4 with media-query dark mode (27 files have `dark:` variants); no user override exists

## 1. Overview

Add a user-controllable theme system to `cameronhartman.dev`. Ship two axes: a **mode axis** (Light / Dark / System) that drives the existing `dark:` Tailwind variants, and a **palette axis** (Default / Matrix) that swaps CSS variables for a personality theme. The user-facing toggle is a 4-state segment: **Light · Dark · Matrix · System**.

Matrix is delivered at the **Cinematic** flavor: neon green on near-black, JetBrains Mono body, faint scanline overlay, soft text-shadow glow on headings, blinking terminal cursor in the hero. No digital-rain canvas in this spec (deferred — easy to add later behind a `?rain=1` toggle without architecture change).

The architecture is deliberately extensible so future personality themes (editorial / technical / minimal, per `2026-05-09-cv-design.md` §11) drop in as additional `data-theme` values without touching component code.

## 2. Goals & non-goals

### Goals
- Visitors can pick Light / Dark / Matrix / System and have it persist across pages and reloads.
- System mode respects `prefers-color-scheme` and re-resolves live when the OS changes setting.
- Zero flash of unstyled content (FOUC): the correct theme is applied before first paint.
- Zero regression to the existing 27 files of `dark:` Tailwind usage.
- CSP stays strict — any new inline script is pinned by SHA-256 hash, not unblocked via `'unsafe-inline'`.
- Matrix theme is recruiter-survivable on `/cv` — still readable, no nauseating motion, respects `prefers-reduced-motion`.
- Architecture supports adding a third / fourth personality theme later by adding rows to one CSS file and one toggle component — no per-component changes.

### Non-goals
- Personality themes beyond Matrix (editorial, technical, minimal) — remain deferred to a future spec.
- Digital-rain canvas background — explicitly out, gated behind a later `?rain=1` enhancement.
- Per-page theming (e.g. force-light on `/cv`). Theme is site-wide.
- Server-side theme negotiation. Site is static; client-only is correct.
- Animated cross-fade transitions on theme switch (causes jank, animates unrelated property changes).
- Custom user colors / accent picker.

## 3. User experience

### 3.1 Toggle UI

A 4-segment control mounted in `Nav.astro`, right-aligned, between the existing nav links and the right edge:

```
[ ☀ Light ] [ 🌙 Dark ] [ ▮ Matrix ] [ ⎙ System ]
```

- Visually a `role="radiogroup"`, each segment `role="radio"`.
- Active segment has filled background + `aria-checked="true"`.
- Keyboard: Tab focuses the group, arrow keys move between segments, Space/Enter activates.
- Labels are visually shown on desktop; on screens narrower than `sm`, collapse to icons only with `aria-label`.
- Click immediately applies the theme and writes to `localStorage`.
- No confirmation, no toast.

### 3.2 Default behavior

- First-time visitors with no saved preference → resolved theme = `system`, palette = `default`.
- Stored value `system` continues to track OS preference live; flipping OS dark mode while the tab is open updates the page immediately.
- Stored values are persisted under one localStorage key (see §4.2).
- If localStorage is unavailable (private mode, cookies-disabled flavor of Safari) the site falls back to a per-tab in-memory store; the toggle still works for the current session.

### 3.3 Matrix specifics (Cinematic flavor)

- Background: near-black `#050b06` with subtle vertical scanline overlay (CSS repeating-linear-gradient at low opacity).
- Foreground text: neon green `#39ff14` for body, brighter green `#9dff70` for accents/links.
- Body font: `JetBrains Mono` (already loaded). Headings: same, slightly heavier weight.
- Headings carry a soft green `text-shadow: 0 0 6px rgba(57,255,20,0.45)`.
- Hero-section terminal cursor blink: a `::after` pseudo-element with `animation: blink 1s steps(1) infinite`. Suppressed under `@media (prefers-reduced-motion: reduce)`.
- Scanline overlay opacity is dialed low enough (~0.04) that `/cv` body text remains 4.5:1 contrast against the background. Verified at build time, not runtime (see §6.3).
- No `<canvas>`, no JS-driven effects. Pure CSS.

## 4. Architecture

### 4.1 Two-axis model

| Axis | Carrier | Values | What it controls |
|---|---|---|---|
| Mode | `<html class="dark">` (boolean) | dark / not-dark | Tailwind v4 `dark:` variants (existing 27 files unchanged) |
| Palette | `<html data-theme="X">` | `default` (omitted) or `matrix` | CSS variables in `global.css` |

A given user-facing theme selection resolves to a tuple:

| User selection | Mode | Palette | Notes |
|---|---|---|---|
| Light | not-dark | default | `<html>` carries neither attribute |
| Dark | dark | default | `<html class="dark">` |
| Matrix | dark | matrix | `<html class="dark" data-theme="matrix">` — palette overrides on top of dark base |
| System | follows OS | default | `<html class="dark">` iff `prefers-color-scheme: dark` |

Matrix piggybacking on dark mode means the existing dark-mode coverage gives Matrix sensible defaults for every component; the matrix palette only needs to override the few colors that differ from default-dark.

### 4.2 Storage contract

One localStorage key: `cv.theme`. Value is one of `"light" | "dark" | "matrix" | "system"`. Absent / unparseable → treated as `system`.

No second key for the palette axis — palette is derivable from the single stored value (only `matrix` selects a non-default palette today).

### 4.3 Files

**Modified:**
- `src/styles/global.css`
  - Add `@custom-variant dark (&:where(.dark, .dark *));` — switch Tailwind v4 from media-query dark to class-based dark.
  - Add CSS variable defaults under `:root` and matrix overrides under `[data-theme="matrix"]` (see §4.5).
  - Add `@keyframes blink` and the scanline / cursor CSS, scoped to `[data-theme="matrix"]`.
- `src/layouts/Base.astro`
  - Remove `bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100` from `<html>`; move equivalent base classes to `<body>` so the `<html>` element is reserved for theme attribute carriers.
  - Inject inline pre-paint `<script>` (see §4.4).
  - Append the script's SHA-256 hash to `astroInlineScriptHashes`.
- `src/components/Nav.astro`
  - Mount `<ThemeToggle client:idle />` on the right side of the nav bar.

**New:**
- `src/lib/theme.ts` — pure module, no top-level DOM access:
  ```ts
  export type Stored = 'light' | 'dark' | 'matrix' | 'system';
  export type Resolved = { mode: 'light' | 'dark'; palette: 'default' | 'matrix' };
  export const STORAGE_KEY = 'cv.theme';
  export function resolveTheme(stored: Stored, prefersDark: boolean): Resolved;
  export function applyTheme(resolved: Resolved, html: HTMLElement): void;
  export function getStoredTheme(): Stored;     // localStorage-safe
  export function setStoredTheme(v: Stored): void;
  ```
- `src/components/ThemeToggle.tsx` — React island, `client:idle`. Owns the toggle UI, subscribes to `matchMedia` changes (only relevant when stored is `system`), and to cross-tab `storage` events.

**Tests:**
- `tests/unit/theme.test.ts` — `resolveTheme` truth table (4 stored × 2 OS-pref = 8 cases) + `applyTheme` DOM assertions on a jsdom `<html>`.
- `tests/integration/csp-meta.test.ts` — extend the pinned hash list with the theme-bootstrap hash; assert it matches the rendered HTML.
- `tests/e2e/theme-toggle.spec.ts` — Playwright: click each of the four segments, assert `<html>` attributes flip, assert palette CSS variables change (read via `getComputedStyle`), reload + assert persistence, in `system` mode toggle the emulated `prefers-color-scheme` and assert the page reacts.

### 4.4 Pre-paint inline script

Synchronous, in `<head>`, before any stylesheet `<link>` and before `<body>` opens. Pseudocode:

```js
(function () {
  try {
    var stored = localStorage.getItem('cv.theme') || 'system';
    var prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    var darkMode = stored === 'dark' || stored === 'matrix' || (stored === 'system' && prefersDark);
    var html = document.documentElement;
    if (darkMode) html.classList.add('dark');
    if (stored === 'matrix') html.setAttribute('data-theme', 'matrix');
  } catch (e) { /* private mode / blocked storage — fall through to defaults */ }
})();
```

The bytes of this script are fixed at build time; its SHA-256 is computed once and added to `astroInlineScriptHashes` alongside the existing four Astro hashes. The csp-meta test pins it. If the script ever changes, the test fails and forces a hash update.

### 4.5 CSS variables

Variables live in `global.css`; values reference Tailwind v4 color tokens via `var(--color-*)` where possible, with explicit hex for matrix:

```css
:root {
  --cv-bg: var(--color-white);
  --cv-fg: var(--color-neutral-900);
  --cv-accent: var(--color-blue-600);
  --cv-surface: var(--color-neutral-50);
  --cv-font-body: var(--font-sans);
}

:where(.dark) {
  --cv-bg: var(--color-neutral-950);
  --cv-fg: var(--color-neutral-100);
  --cv-accent: var(--color-blue-400);
  --cv-surface: var(--color-neutral-900);
}

[data-theme='matrix'] {
  --cv-bg: #050b06;
  --cv-fg: #39ff14;
  --cv-accent: #9dff70;
  --cv-surface: #081108;
  --cv-font-body: var(--font-mono);
}
```

(Custom names are prefixed `--cv-*` to avoid clashing with Tailwind's own `--color-*` tokens.)

Existing components are NOT migrated to consume these variables in this spec. They keep using Tailwind tokens (`bg-white dark:bg-neutral-950` etc.) and continue to work. Matrix-specific style rules live in `global.css` under `[data-theme="matrix"]` selectors and target the `<body>` and a small set of semantic elements (`h1, h2, h3, a, body`) — not individual components. This keeps Matrix as a global "skin" rather than a per-component rewrite.

A future spec that introduces editorial/technical themes will likely migrate components to consume `var(--color-*)` directly; that migration is explicitly out of scope here.

## 5. Component design

### 5.1 ThemeToggle.tsx (React island)

State: `stored: Stored` (mirrors localStorage).

Lifecycle:
- On mount: read `getStoredTheme()`, set state.
- On mount: subscribe to `matchMedia('(prefers-color-scheme: dark)')` `change` events. The handler only matters when `stored === 'system'`; in that case, recompute resolved and re-apply.
- On mount: subscribe to `window.storage` events so changing the theme in one tab updates other open tabs.
- On unmount: tear down both listeners.

User action handler:
- On segment click: `setStoredTheme(v)` → `applyTheme(resolveTheme(v, mql.matches), document.documentElement)` → `setState({stored: v})`.

Rendering: a `<fieldset role="radiogroup" aria-label="Color theme">` with four `<button role="radio">` children. Active button has `aria-checked="true"` and a filled background. Icons are hand-rolled inline SVG (no new dependency — the site already keeps its icon footprint minimal); icons sit left of the label on `sm+` screens; on smaller screens labels are visually hidden but kept for screen readers via `sr-only`.

### 5.2 lib/theme.ts contract

Pure functions only — no module-level side effects. Pure functions are unit-testable in jsdom with no setup. `resolveTheme` is the truth table that the e2e test verifies behaviorally and the unit test verifies exhaustively.

`applyTheme` is idempotent: calling it twice with the same input produces the same DOM.

`getStoredTheme` returns `'system'` for any failure mode (no window, no storage, malformed value, throw on access). `setStoredTheme` swallows write failures silently (private mode shouldn't crash the toggle).

## 6. Quality

### 6.1 Tests

| Layer | File | Coverage |
|---|---|---|
| Unit | `tests/unit/theme.test.ts` | `resolveTheme` × 8 combos; `applyTheme` on jsdom `<html>`; `getStoredTheme` fallback when localStorage throws |
| Integration | `tests/integration/csp-meta.test.ts` (extended) | Bootstrap script hash present in CSP; rendered HTML script hash matches |
| Integration | `tests/integration/theme-bootstrap.test.ts` (new) | Render any page; assert the bootstrap script appears in `<head>` before the first `<link>` |
| E2E | `tests/e2e/theme-toggle.spec.ts` | All 4 segments toggle correctly; reload persists; system-mode reacts to OS-pref change; Matrix applies scanline class + custom `--color-fg`; `prefers-reduced-motion` disables cursor blink |

### 6.2 Manual verification checklist

- Every page (`/`, `/cv`, `/playground`, `/projects/leddisplay`, `/security`, `/404`) in all four modes — eyeball legibility.
- AI playground in Matrix mode: chat input + cards still readable.
- Activity dashboard SVGs (heatmap, donut, freshness timeline, HTB card) in all four modes — colors don't blow out.
- iOS Safari + Chrome Android: toggle works, no FOUC, no scroll jank from scanline.
- `prefers-reduced-motion` enabled: terminal cursor stops blinking; toggle still works.

### 6.3 Build-time guards

A Vitest test computes the WCAG contrast ratio between `--cv-fg` (`#39ff14`) and `--cv-bg` (`#050b06`) and asserts ≥ 4.5:1. The scanline overlay is at ~4% opacity so it doesn't meaningfully shift the effective background luminance — the test ignores the overlay and uses the base bg color, which is a stricter (and simpler) assertion than computing a blended value.

### 6.4 Performance

- Bootstrap script: ~250 bytes, sync, inline — adds ≤ 1ms to TTFB.
- ThemeToggle island: `client:idle`, ships after first paint.
- No additional font loads. The site uses system-installed `'Inter'` / `'JetBrains Mono'` with `system-ui` / `ui-monospace` fallbacks; no webfont is shipped. Matrix mode swaps the body font-family stack; users without JetBrains Mono installed get `ui-monospace`, which still reads correctly.
- Scanline is a single `repeating-linear-gradient`, GPU-composited, no repaint cost.
- No regression to existing Lighthouse score targets.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| FOUC on first load if the bootstrap script is moved or skipped | csp-meta + bootstrap-test pin both presence and content |
| CSP hash drift if the bootstrap script ever changes | Same — csp-meta test fails loudly |
| Matrix theme makes `/cv` unscannable for recruiters | Contrast guard (§6.3); manual /cv check in §6.2; `prefers-reduced-motion` suppresses blink |
| Existing dark variants stop working when we switch to class-based dark | E2E asserts dark mode works in both Dark and System+OS-dark; manual check across all pages |
| Adding a new theme later requires touching many components | Architecture deliberately keeps Matrix as a global skin via CSS variables; future themes follow the same pattern |
| localStorage unavailable (private mode) | `getStoredTheme` falls back to `system`; in-memory fallback preserves toggle within the session |

## 8. Out of scope (explicit)

- Editorial / technical / minimal personality themes.
- Digital-rain canvas background (revisit as `?rain=1` enhancement).
- Per-page theme overrides.
- Migrating existing components from Tailwind tokens to CSS variables.
- Cookie-based persistence (localStorage only).
- Theme-aware OG images / favicons.

## 9. Open decisions made under autopilot

These were ratified by the user's "Cinematic, go" approval; flag any to revisit:

1. **Default = System.** Matches current behavior.
2. **Persistence = localStorage** under key `cv.theme`. No cookie.
3. **Toggle UI = 4-segment radiogroup in Nav.** Not a popover or dropdown.
4. **No transitions on theme switch.**
5. **Matrix = Cinematic flavor.** No digital rain in this spec.
6. **Matrix piggybacks on dark mode** (`class="dark" data-theme="matrix"`) rather than introducing a third mode-axis value.
7. **Existing 27 files of `dark:` usage NOT migrated** to CSS variables. Matrix overrides happen at the global level only.

## 10. Implementation order (preview — full plan follows in writing-plans)

1. Switch `dark:` from media-query to class-based via `@custom-variant`. Verify all 27 files still render correctly under the new resolver (E2E for OS-dark case + manual sweep).
2. Add `src/lib/theme.ts` + unit tests.
3. Add inline bootstrap script to `Base.astro`; compute hash; update CSP allowlist; update csp-meta test; add new bootstrap-presence test.
4. Add `ThemeToggle.tsx`; mount in `Nav.astro`; cross-tab sync; system-mode `matchMedia` listener.
5. Add CSS variables + matrix palette + scanline + cursor blink.
6. Add Playwright E2E for the toggle, persistence, OS-pref reaction, Matrix application.
7. Add contrast-ratio build guard.
8. Manual sweep across all pages × all four modes.
9. PR, CI green, merge, verify on `cameronhartman.dev`.

## 11. Acceptance criteria

- A visitor can pick any of Light / Dark / Matrix / System from the Nav, see the page change immediately, and find the choice still applied after a hard reload.
- A visitor in System mode toggling their OS color scheme sees the page react without a reload.
- No flash of the wrong theme on first paint in any mode.
- All 98 existing unit/integration tests still pass; the new theme tests pass; the new bootstrap-presence and contrast-ratio tests pass; the new E2E spec passes.
- CSP remains hash-allowlist-only; no `'unsafe-inline'` for scripts.
- Matrix on `/cv` measures ≥ 4.5:1 contrast for body text.
- `prefers-reduced-motion: reduce` suppresses the terminal cursor blink.
