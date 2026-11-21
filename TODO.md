# TODO

Operational, maintenance, and future-enhancement work for `cameronhartman.dev`. Items are grouped by urgency. Read `READ-BEFORE-BURNING.md` before any operational change (DNS, secrets, Pages migration).

**Last updated:** 2026-11-20 (AI playground removed; docs brought in line with the code)

---

## ⛔ Decided NOT to do

Items that were considered and explicitly rejected — recorded so they don't keep getting re-raised. If reopening one, note WHY the original decision is no longer valid.

- **No email on `cameronhartman.dev`** (decided 2026-05-12). The null MX record (`0 .`) declares the domain refuses inbound email, which makes spoofing `@cameronhartman.dev` substantially harder. Cloudflare Email Routing would work fine alongside the GitHub Pages setup, but enabling it requires removing the null MX and that trade — anti-spoofing posture vs. having `info@`/`hello@`/etc. — isn't worth it for a personal CV. Do not propose vanity addresses on this domain without revisiting this decision.
- **No AI features on the site** (decided 2026-11-20). The BYOK playground (CV chat, JD fit analyzer, OpenRouter OAuth, `/playground`, `/oauth/callback`, `src/lib/ai/*`) was removed entirely, along with its dependencies, and the CSP was narrowed to `connect-src 'self'`. History lives in git and in `docs/superpowers/` (Plans 2 and 6). Do not re-add without revisiting this decision.
- **No `5easy` project on the site** (decided 2026-05-13). The `5easy` D&D 5e character manager (TypeScript + Supabase, repo private) was originally flagged `featured: true` in `cv.yaml` projects. Cameron decided it doesn't belong on the public CV. The cv.yaml entry has been removed entirely — no Featured Repos carousel card, no `/cv.json` listing, no JSON-LD entry, no `/projects/5easy/` case study. Do not re-add a `5easy` entry without revisiting this decision.

---

## 🟢 Plan 5 status — themes shipped

Shipped 2026-05-12 across three PRs:

- [x] **#43 (`5f1cd0e`)** — 4-state theme system (Light / Dark / Matrix / System). Two-axis architecture: `<html class="dark">` drives Tailwind `dark:` variants; `<html data-theme="matrix">` swaps `--cv-*` CSS variables. Pre-paint inline bootstrap pinned in CSP via SHA-256 hash. Matrix at Cinematic flavor (#39ff14 on #050b06, JetBrains Mono, scanline at opacity 0.25, heading glow, blinking hero cursor with `prefers-reduced-motion` respected). WCAG contrast guard at `tests/unit/contrast.test.ts`.
- [x] **#45 (`fd4d0b3`)** — converted the inline 4-segment Nav bar to a fixed top-right floating dropdown (`role="menu"` + `menuitemradio` items, click-outside + Escape close).
- [x] **#46 (`e3144e8`)** — vertically centered the trigger to the Nav text band (`top-3`); invisible by default (`opacity-0`), fades in on `hover` / `focus-within` (200ms). `@media (hover: none)` escape keeps it always visible on touch devices. Menu-open state pins opacity to 100.

### Open follow-ups (small, deferred from review)

- [x] **Arrow-key nav inside the menu** (2026-11-20). Opening the menu focuses the checked item; Up/Down/Home/End move focus (roving `tabIndex`).
- [ ] **Trigger `aria-label` flicker on hydration when stored ≠ system.** `useState('system')` renders the trigger with "Color theme: System" until `useEffect` reads localStorage and re-renders. The visual page theme itself never flashes (the bootstrap script handles that pre-paint). Note: a lazy `useState(() => getStoredTheme())` would cause an SSR/hydration mismatch (the server has no localStorage). Options: `client:only="react"` (adds a new Astro inline bootstrap — recompute its CSP hash from `dist/`), or accept the one-render flicker.
- [x] **Spec drift cleaned up** (2026-11-20). Themes spec now records the shipped 0.25 scanline opacity.

---

## 🟡 Calendar / recurring

### PAT rotation (day 80)

- [ ] **Overdue as of 2026-11-20:** `data/activity.json` was last regenerated 2026-05-27, so the nightly refresh has very likely been failing on an expired `GH_API_TOKEN`. Rotate now, then run `gh workflow run refresh-activity.yml` and confirm it opens/merges a PR.
- [ ] Add a calendar reminder **80 days from token creation** to rotate `GH_API_TOKEN` (and `HTB_API_TOKEN` if applicable). Per `READ-BEFORE-BURNING.md`: never extend an existing PAT; always create a new one, swap the secret via `gh secret set`, then revoke the old PAT.

### Domain renewal

- [ ] Confirm `cameronhartman.dev` has auto-renew enabled at the registrar. Set a calendar reminder 2 weeks before expiration as a safety net.

### Periodic Dependabot review

- [ ] Monthly: skim open Dependabot PRs in `CAM-eEng/CV`. Patch + minor → usually safe to merge after CI green. Majors → see the dedicated section below.

---

## 🟢 Dependency status — Dependabot caught up

8 of 9 open Dependabot PRs landed on 2026-05-11 (six were bundled into PR #23 after the per-PR rebase cycles got slow). Current pins:

- `actions/checkout` v6.0.2 · `oven-sh/setup-bun` v2.2.0 · `actions/upload-pages-artifact` v5.0.0 · `actions/deploy-pages` v5.0.0
- `typescript` 6.0.3 · `vitest` 4.1.5 · `@eslint/js` 10.0.1 · `@astrojs/mdx` 5.0.4

### Done

- [x] **Astro 5 → 6.** Landed — `package.json` pins `astro ^6.3.3` and `Base.astro` carries the Astro 6 custom-element bootstrap hash.

---

## 🟢 Content fill-ins

### Project case studies

- [x] `content/projects/leddisplay.mdx` case study written (Problem / Approach / What I built / scan-mode investigation / What I learned).
- [ ] Decide whether the two historical academic projects (`Testing Interface for RF Amplifier` 2019, `Solar Microinverter` 2018) belong in `cv.yaml`. They were ported from the legacy resume.pdf. If you want them visible: add MDX case studies. If not: remove from `cv.yaml`.

### CV body

- [ ] As your role evolves, edit `content/cv.yaml`:
  - Add new bullets to `work[0].highlights` (LitePoint Corp.) as projects ship.
  - Update `basics.summary` if the position title changes.
  - Bump `skills.yaml` `last_used` dates when you start using something seriously.

### Activity visualizer narrative

- [ ] After 1-2 weeks of nightly refreshes accumulate real data, gut-check the visualizer:
  - Does the "tech freshness" timeline reflect what you'd want a recruiter to see? If a skill shows older than feels right, bump `last_used` in `skills.yaml`.
  - Does the featured-repo carousel show the right repos? Toggle `featured: true` in `cv.yaml` accordingly.

---

## 🔵 Future enhancements (deferred from the spec; not blocking)

Each was explicitly out-of-scope or deferred during planning. Pick up if/when valuable.

### Visual identity

- [ ] The spec deferred typography / color / personality decisions. Currently the site uses default Tailwind neutrals + Inter/JetBrains-Mono via `@theme` in `src/styles/global.css`. Three brainstormed directions to compare when ready (notes in the spec §11):
  - **Editorial / serif** — signals depth and considered craft
  - **Technical / monospace-led** — signals engineer-first
  - **Minimal modern** (current) — signals clean execution
- [ ] If revisiting: spawn the visual companion via brainstorming and prototype 2-3 directions before locking in.

### Build-time machine-readable extras (spec §6.4 — deferred)

- [ ] **Per-page OG images** — render via Satori at build time. Plan 1 self-review deferred this; a follow-up implementation plan can target it.
- [ ] **`/resume.pdf` generation** from `cv.yaml` via headless browser (Puppeteer/Playwright in a build step). Recruiters love the PDF download; the `/cv` header already has a "cv.json" link — adding "cv.pdf" next to it would round it out.
- [ ] **RSS feed** for project updates (`/rss.xml`). Astro has built-in support via `@astrojs/rss`. Low priority until you actually post project-update entries.

### Privacy-respecting analytics

- [ ] Optional, only if metrics become useful. Use a cookieless service (Plausible self-hosted, Umami self-hosted, or GoatCounter). Add to the CSP allowlist in `src/layouts/Base.astro` when wiring. No Google Analytics.

### Activity workflow polish

- [ ] **Cache language-byte queries** so the daily refresh doesn't re-pull the same data when nothing changed. Use the `If-Modified-Since` header or cache `pushed_at` per repo. Low priority — even at 30 repos × 1 call each, GitHub's authenticated rate limit (5,000/hr) makes this irrelevant.
- [ ] **Healthcheck**: log a one-line summary in the workflow's output ("Wrote 365 days, 12 languages, 24 repos, htb: present") so failures are visible at a glance in `gh run list`.

### Activity dashboard responsiveness

- [ ] **Mobile horizontal overflow on `/`** ([#44](https://github.com/CAM-eEng/CV/issues/44)). Surfaced during the themes-foundation sweep: at 375px viewport, `body.scrollWidth` is 494px (light/dark/system) or 509px (matrix; +15px from monospace metrics). Pre-existing — not introduced by themes. Likely culprits: `ContributionHeatmap` (53 × 7 fixed cells ≈ 444px floor), `LanguagesDonut` (donut + side-by-side legend), `FreshnessTimeline` (fixed skill-name column). Fix sketch in the issue. Acceptance: `body.scrollWidth ≤ 377` at 375px viewport in every theme.

### Misc

- [ ] **Update the `gh repo edit` description** for `CAM-eEng/CV` — it still says "Astro 5 + React 19 + BYOK AI features". Suggested: `gh repo edit CAM-eEng/CV --description "Online CV at cameronhartman.dev — built on Astro 6 + React 19."`
- [ ] Update `CAM-eEng/portfolio` repo description to point at the new site and archive it.

---

## Reference

- **Spec**: `docs/superpowers/specs/2026-05-09-cv-design.md`
- **Plans**:
  - `docs/superpowers/plans/2026-05-09-cv-foundation.md` (Plan 1 — shipped, `v1.0-foundation`)
  - `docs/superpowers/plans/2026-05-11-cv-ai-features.md` (Plan 2 — shipped, `v2.0-ai-features`; removed 2026-11-20)
  - `docs/superpowers/plans/2026-05-11-cv-activity-visualizer.md` (Plan 3 — shipped, `v3.0-activity-visualizer`)
- **Operational gotchas**: `READ-BEFORE-BURNING.md`
- **Live site**: `https://cameronhartman.dev`
- **Default Pages URL** (fallback if custom domain has DNS issues): `https://cam-eeng.github.io/CV/`
