# TODO

Operational, maintenance, and future-enhancement work for `cameronhartman.dev`. Items are grouped by urgency. Read `READ-BEFORE-BURNING.md` before any operational change (DNS, secrets, Pages migration).

**Last updated:** 2026-05-11

---

## 🔴 Now — unblocks Plan 3 from showing real data

The activity dashboard at the top of `cameronhartman.dev/` currently shows "Activity dashboard pending first nightly refresh" because the nightly workflow has no credentials yet. Set these up:

### 1. Create a fine-grained GitHub PAT

- [ ] Visit `https://github.com/settings/personal-access-tokens/new`
- [ ] **Resource owner:** `CAM-eEng`
- [ ] **Repository access:** "Public repositories (read-only)" — or restrict to just `CAM-eEng/CV`
- [ ] **Repository permissions:** Contents = **Read-only**, Metadata = Read-only (auto-selected)
- [ ] **Account permissions:** none
- [ ] **Expiration:** 90 days
- [ ] **Token name:** `cv-refresh-activity-2026Q2`
- [ ] Generate → copy the token (starts with `github_pat_…`)

### 2. (Optional) HackTheBox token + user ID

Skip this section if you don't use HackTheBox — the workflow will set `htb: null` and the HTB card won't render.

- [ ] Sign in to `https://www.hackthebox.com`
- [ ] Profile → Settings → API → "Create App Token"
- [ ] Copy the JWT (starts with `eyJ…`)
- [ ] Note your numeric user ID (visible in the URL of your profile page)

### 3. Set the repo secrets

```bash
gh secret set GH_API_TOKEN --body 'github_pat_…'       # required
gh secret set HTB_API_TOKEN --body 'eyJ…'              # optional
gh secret set HTB_USER_ID --body 'NNNNN'               # optional
gh secret list                                          # verify
```

### 4. Trigger the first refresh

```bash
gh workflow run refresh-activity.yml
gh run watch
```

Expected: the workflow fetches GitHub + (optionally) HTB, writes `data/activity.json`, commits as `github-actions[bot]`, and the deploy workflow fires automatically. Within ~3 minutes:

```bash
curl -sf https://cameronhartman.dev/ | grep -oE "Recent activity"
```

…should return `Recent activity` (instead of the empty-stub message).

### 5. Tell me when done so I can sanity-check

- [ ] Ping the chat with "secrets set, refresh triggered" and I'll verify the dashboard renders correctly end-to-end.

---

## 🟡 Calendar / recurring

### PAT rotation (day 80)

- [ ] Add a calendar reminder **80 days from token creation** to rotate `GH_API_TOKEN` (and `HTB_API_TOKEN` if applicable). Per `READ-BEFORE-BURNING.md`: never extend an existing PAT; always create a new one, swap the secret via `gh secret set`, then revoke the old PAT.

### Domain renewal

- [ ] Confirm `cameronhartman.dev` has auto-renew enabled at the registrar. Set a calendar reminder 2 weeks before expiration as a safety net.

### Periodic Dependabot review

- [ ] Monthly: skim open Dependabot PRs in `CAM-eEng/CV`. Patch + minor → usually safe to merge after CI green. Majors → see the dedicated section below.

---

## 🟠 Open Dependabot PRs (review and merge or close)

As of 2026-05-11 there are **9 open Dependabot PRs**. Walk through them in this order:

### Safe to merge after CI green (low blast radius)

- [ ] **PR #2** — `oven-sh/setup-bun` 2.0.1 → 2.2.0 (GitHub Action minor bump)
- [ ] **PR #1** — `actions/checkout` v4.1.7 → v6.0.2 *(major; review changelog — usually backward-compatible for our usage)*

### Major framework bumps — review before merging

- [ ] **PR #5** — `@astrojs/mdx` 4.3.14 → 5.0.4. Major. Read MDX 5 migration notes; likely fine since we use plain MDX with frontmatter.
- [ ] **PR #6** — `typescript` 5.9.3 → 6.0.3. Major. Run `bun run build` against the PR branch locally; flag any new errors.
- [ ] **PR #7** — `vitest` 3.2.4 → 4.1.5. Major. Read Vitest 4 migration notes (especially `vi.spyOn` and `MockInstance` typing — already had a brush with these in Plan 2).
- [ ] **PR #8** — `astro` 5.18.1 → 6.3.1. Major. **Highest blast radius.** Astro 6 likely changes CSP hash values (different inline bootstrap script). Read changelog, test locally, regenerate hashes in `src/layouts/Base.astro` if needed.
- [ ] **PR #9** — `@eslint/js` 9.39.4 → 10.0.1. Major. Watch for new rules that trigger our existing source.

### Pages-deploy actions — extra care

- [ ] **PR #3** — `actions/upload-pages-artifact` 3.0.1 → 5.0.0. Touches deployment. Test in a workflow dispatch on a feature branch before merging.
- [ ] **PR #4** — `actions/deploy-pages` 4.0.5 → 5.0.0. Same — touches deployment.

**Order recommendation:** start with #2 (lowest risk) → #1 → #5 → #9 → #7 → #6 → #3 → #4 → #8 (Astro 6 last, biggest unknown).

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
