# CV — cameronhartman.dev

Online CV / online resume. Replaces the legacy `cam-eeng.github.io/portfolio` site.

See `docs/superpowers/specs/2026-05-09-cv-design.md` for the full design.
**Read `READ-BEFORE-BURNING.md` before doing anything operational** (DNS, secrets, Pages migration).

## Content

CV content is hand-authored YAML and MDX, validated by Zod on load:

- `content/cv.yaml` — JSON Resume schema (basics, work, education, skills, projects)
- `content/skills.yaml` — categorized skills with `last_used` dates (drives the freshness timeline in Plan 3)
- `content/projects/*.mdx` — long-form project case studies
- `data/activity.json` — GitHub + HackTheBox snapshot, regenerated nightly by `.github/workflows/refresh-activity.yml` (Plan 3)

The site's canonical URL constant lives in `src/lib/site.ts`.

## Develop

```bash
bun install
bun run dev          # http://localhost:4321
bun run build        # production build → ./dist
bun run test         # unit + integration tests (use 'bun run test', not 'bun test')
bun run test:e2e     # Playwright
bun run lint
```

## Deploy

`main` branch auto-deploys to GitHub Pages via `.github/workflows/deploy.yml`.
Custom domain `cameronhartman.dev` is configured via `public/CNAME`.
