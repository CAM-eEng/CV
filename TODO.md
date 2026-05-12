# TODO

Operational, maintenance, and future-enhancement work for `cameronhartman.dev`. Items are grouped by urgency. Read `READ-BEFORE-BURNING.md` before any operational change (DNS, secrets, Pages migration).

**Last updated:** 2026-05-12 (after Plan 5 themes shipped)

---

## 🟢 Plan 5 status — themes shipped

Shipped 2026-05-12 across three PRs:

- [x] **#43 (`5f1cd0e`)** — 4-state theme system (Light / Dark / Matrix / System). Two-axis architecture: `<html class="dark">` drives Tailwind `dark:` variants; `<html data-theme="matrix">` swaps `--cv-*` CSS variables. Pre-paint inline bootstrap pinned in CSP via SHA-256 hash. Matrix at Cinematic flavor (#39ff14 on #050b06, JetBrains Mono, scanline at opacity 0.25, heading glow, blinking hero cursor with `prefers-reduced-motion` respected). WCAG contrast guard at `tests/unit/contrast.test.ts`.
- [x] **#45 (`fd4d0b3`)** — converted the inline 4-segment Nav bar to a fixed top-right floating dropdown (`role="menu"` + `menuitemradio` items, click-outside + Escape close).
- [x] **#46 (`e3144e8`)** — vertically centered the trigger to the Nav text band (`top-3`); invisible by default (`opacity-0`), fades in on `hover` / `focus-within` (200ms). `@media (hover: none)` escape keeps it always visible on touch devices. Menu-open state pins opacity to 100.

### Open follow-ups (small, deferred from review)

- [ ] **Arrow-key nav inside the menu.** APG `menuitemradio` pattern expects Up/Down to move focus between items; currently only Tab + click work. Not a WCAG failure but expected by keyboard-power users.
- [ ] **Trigger `aria-label` flicker on hydration when stored ≠ system.** `useState('system')` renders the trigger with "Color theme: System" until `useEffect` reads localStorage and re-renders. The visual page theme itself never flashes (the bootstrap script handles that pre-paint). Fix: lazy-init `useState(() => getStoredTheme())`.
- [ ] **Spec drift to clean up.** `docs/superpowers/specs/2026-05-11-cv-themes-design.md` §3.3 and §6.3 still describe the scanline overlay at opacity ~0.04; the implementation ships at 0.25. Pure doc fix.

---

## 🟢 Plan 3 status — live with real data

- [x] **GH_API_TOKEN set + rotated** after the original was exposed in chat.
- [x] **HTB switched from API → manual JSON.** HackTheBox no longer exposes self-service app tokens for many account tiers; replaced with `data/htb-manual.json` (gitignore-safe, hand-edited).
- [x] **Refresh workflow** opens a PR (auto-merge on CI pass) instead of pushing direct to main; bypasses branch-protection bot-rejection.
- [x] **First refresh ran successfully.** `data/activity.json` now reflects real GitHub data (48 contributions over the year, real repo set, real language donut, real freshness timeline). Dashboard at `cameronhartman.dev/` shows the live data.

### Still to do (optional / async)

- [ ] **Fill in `data/htb-manual.json`** (work in progress — file created from template). Edit `rank`, `points`, `ownedMachines`, and `categories` with real values; remove the `_doc` field; commit + PR. The next refresh will publish the HTB card.

- [ ] **Make LedDisplay public** so the Featured Repos section appears. Currently `cv.yaml` flags LedDisplay + 5easy as `featured: true` but both are private, so the carousel filter returns nothing and the section is hidden. Flipping LedDisplay public surfaces it automatically on the next refresh.

---

## 🟡 Calendar / recurring

### PAT rotation (day 80)

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

### Still pending

- [ ] **Astro 5 → 6 (PR #8 was closed).** Blocked by a Vite-version type incompatibility between Astro 6's bundled Vite and `@tailwindcss/vite`'s current build (a `Plugin<any>` ↔ `PluginOption` mismatch). Re-evaluate when `@tailwindcss/vite` ships a release built against Vite 7+. Will likely also require regenerating the four SHA-256 hashes in `src/layouts/Base.astro`'s CSP since Astro 6 changes its inline hydration bootstrap. Dependabot will re-create the PR when a newer Astro lands.

---

## 🟢 Content fill-ins

### Project case studies

- [ ] Replace the placeholder body in `content/projects/leddisplay.mdx`. Headings are scaffolded (Problem / Approach / What I built / What I learned) — fill in real narrative. The LedDisplay auto-memory at `~/.claude/projects/-home-dexter/memory/project_leddisplay.md` has detailed technical context (1/16 vs 1/32 scan investigation, panel-compatibility findings, USB-C power constraints, two-step deploy workflow) — paste from there.
- [ ] Decide whether to add a `content/projects/5easy.mdx` case study. Currently `5easy` appears in `cv.yaml` projects with `featured: true`, so it'll show in the Featured Repos carousel once Plan 3 secrets are set — but there's no long-form case study at `/projects/5easy/`. Either write one or remove `featured: true` from the cv.yaml entry.
- [ ] Decide whether the two historical academic projects (`Testing Interface for RF Amplifier` 2019, `Solar Microinverter` 2018) belong in `cv.yaml`. They were ported from the legacy resume.pdf. If you want them visible: add MDX case studies. If not: remove from `cv.yaml`.

### CV body

- [ ] As your role evolves, edit `content/cv.yaml`:
  - Add new bullets to `work[0].highlights` (LitePoint) as projects ship.
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

### Plan 2 polish (deferred)

- [ ] In `src/lib/ai/openrouter.ts` the default model is `google/gemini-2.5-flash-lite:free` — confirm this model name is still current on OpenRouter (model IDs sometimes shift). If you want to default to Claude or GPT, change the `defaultModel`.
- [ ] The system prompt in `src/lib/ai/system-prompt.ts` is ~25k tokens with the full CV. Once you have more work history, periodically check the token count and consider summarizing older roles.

### Misc

- [ ] **Set the `gh repo edit` description** for `CAM-eEng/CV` so the GitHub repo card reads cleanly: currently empty. Suggestion: "Online CV at cameronhartman.dev — built on Astro 5 + React 19 + BYOK AI features (Claude, OpenAI, OpenRouter)."
- [ ] Update `CAM-eEng/portfolio` repo description to point at the new site and archive it.

---

## Reference

- **Spec**: `docs/superpowers/specs/2026-05-09-cv-design.md`
- **Plans**:
  - `docs/superpowers/plans/2026-05-09-cv-foundation.md` (Plan 1 — shipped, `v1.0-foundation`)
  - `docs/superpowers/plans/2026-05-11-cv-ai-features.md` (Plan 2 — shipped, `v2.0-ai-features`)
  - `docs/superpowers/plans/2026-05-11-cv-activity-visualizer.md` (Plan 3 — shipped, `v3.0-activity-visualizer`)
- **Operational gotchas**: `READ-BEFORE-BURNING.md`
- **Live site**: `https://cameronhartman.dev`
- **Default Pages URL** (fallback if custom domain has DNS issues): `https://cam-eeng.github.io/CV/`
