# CV — cameronhartman.dev

Online CV / online resume. Replaces the legacy `cam-eeng.github.io/portfolio` site.

See `docs/superpowers/specs/2026-05-09-cv-design.md` for the full design.
**Read `READ-BEFORE-BURNING.md` before doing anything operational** (DNS, secrets, Pages migration).

## Develop

```bash
bun install
bun run dev          # http://localhost:4321
bun run build        # production build → ./dist
bun run test         # unit tests (use 'bun run test', not 'bun test')
bun run test:e2e     # Playwright
bun run lint
```

## Deploy

`main` branch auto-deploys to GitHub Pages via `.github/workflows/deploy.yml`.
Custom domain `cameronhartman.dev` is configured via the repo-root `CNAME` file.
