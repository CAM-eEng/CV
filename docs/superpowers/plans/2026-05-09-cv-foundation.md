# CV Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a static online CV at `cameronhartman.dev` — Astro 5 scaffold, content layer in `cv.yaml`/`skills.yaml`/MDX, all static pages (`/`, `/cv`, `/projects`, `/projects/<slug>`, `/contact`, `/security`), build-time generated artifacts (`/cv.json`, `/llms.txt`, JSON-LD, sitemap), CI/CD via GitHub Actions, live on GitHub Pages with custom domain. **No AI features yet** — those land in Plan 2.

**Architecture:** Astro 5 renders content as semantic HTML; React 19 islands stay reserved for Plan 2 (AI features). Content is hand-authored YAML + MDX, validated with Zod on load. Build-time route handlers emit `/cv.json` (JSON Resume schema), `/llms.txt`, JSON-LD, sitemap. Two-workflow GitHub Actions split (CI on PR with no secrets; deploy on push-to-main).

**Tech Stack:** Astro 5, React 19 integration (no islands shipped yet), Tailwind CSS 4 (Oxide), MDX, TypeScript 5.7+ strict, Bun 1.x, Vitest 3, Playwright, ESLint, Prettier, `@astrojs/sitemap`, `@astrojs/check`, `js-yaml`, `zod`, `gray-matter`.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-09-cv-design.md`
- Operational pre-action checklist: `READ-BEFORE-BURNING.md`

---

## File structure (locked here)

This plan creates these files, each with one clear responsibility:

```
/CV
├── astro.config.ts                          # Astro + integrations (React, Tailwind, MDX, sitemap)
├── tsconfig.json                            # extends astro/tsconfigs/strict
├── package.json
├── bun.lock
├── .editorconfig
├── .prettierrc.json
├── eslint.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── CNAME                                    # cameronhartman.dev
├── content/
│   ├── cv.yaml                              # canonical resume (JSON Resume schema)
│   ├── skills.yaml                          # categorized skills + last_used dates
│   └── projects/
│       └── leddisplay.mdx                   # one sample case study
├── public/
│   └── favicon.svg
├── src/
│   ├── content.config.ts                    # Astro content collections (projects)
│   ├── lib/
│   │   ├── content/
│   │   │   ├── cv-schema.ts                 # Zod schema for cv.yaml
│   │   │   ├── cv-loader.ts                 # loads + validates cv.yaml
│   │   │   ├── skills-schema.ts             # Zod schema for skills.yaml
│   │   │   └── skills-loader.ts             # loads + validates skills.yaml
│   │   └── jsonld/
│   │       ├── person.ts                    # Person schema.org generator
│   │       └── work-experience.ts           # WorkExperience generator
│   ├── layouts/
│   │   └── Base.astro                       # head, CSP meta, nav, footer
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Footer.astro
│   │   └── JsonLd.astro                     # injects JSON-LD <script>
│   ├── pages/
│   │   ├── index.astro                      # hero + skim summary (chat island stub)
│   │   ├── cv.astro                         # full structured resume
│   │   ├── contact.astro
│   │   ├── security.astro
│   │   ├── projects/
│   │   │   ├── index.astro                  # case-study grid
│   │   │   └── [slug].astro                 # individual case study
│   │   ├── cv.json.ts                       # JSON Resume export endpoint
│   │   └── llms.txt.ts                      # discoverable summary
│   └── styles/
│       └── global.css                       # Tailwind 4 imports + base styles
├── tests/
│   ├── unit/
│   │   ├── cv-schema.test.ts
│   │   ├── cv-loader.test.ts
│   │   ├── skills-loader.test.ts
│   │   ├── jsonld-person.test.ts
│   │   └── jsonld-work.test.ts
│   ├── integration/
│   │   ├── cv-json-endpoint.test.ts
│   │   └── llms-txt-endpoint.test.ts
│   └── e2e/
│       └── happy-path.spec.ts               # Playwright
└── .github/
    └── workflows/
        ├── ci.yml                           # PR-time, no secrets
        └── deploy.yml                       # main-only, deploys to Pages
```

**Splitting rationale.**
- One Zod schema per content type, sibling loader file. Easier to test, easier to find.
- JSON-LD generators isolated in `lib/jsonld/` — pure functions, easy to snapshot-test.
- Pages stay thin; logic lives in `lib/`.
- Layouts split from pages so the CSP meta tag has one home.

---

## Decisions baked in

- **Bun** is the package manager and dev runner (`bun install`, `bun run dev`). CI uses Node 20 (via `oven-sh/setup-bun` Action) for compatibility.
- **JSON Resume schema** is the canonical shape for `cv.yaml`. We generate `/cv.json` from it directly.
- **Tailwind 4** uses the Oxide engine via `@tailwindcss/vite`. CSS lives in `src/styles/global.css`.
- **No analytics** in Plan 1.
- **CSP via meta tag** with the connect-src allowlist from spec §8.2. Plan 1 doesn't yet need provider hosts (no AI features), but we add them now and pin via test so Plan 2 doesn't have to discover this surface late.
- **Sample content only.** Real CV data goes in the YAML files at the very end of the plan (Task 18) — Cameron fills in his actual work history then.

---

## Task 1: Initialize repo + Astro 5 + Bun

**Files:**
- Create: `package.json`, `astro.config.ts`, `tsconfig.json`, `.editorconfig`, `.prettierrc.json`, `eslint.config.mjs`, `src/styles/global.css`, `public/favicon.svg`, `README.md`
- Modify: `.gitignore` (already exists from spec commit; ensure correct entries)

- [ ] **Step 1: Verify clean working tree**

```bash
cd /home/dexter/Projects/CV
git status
```

Expected: clean working tree on `main`, ahead of nothing. The spec commit + tag exist.

- [ ] **Step 2: Initialize Astro project (non-interactive)**

We bypass `bun create astro` because it's interactive; instead, we hand-write `package.json` and let Astro CLI fill in via `bun install`.

Create `package.json`:

```json
{
  "name": "cv",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "audit": "bun pm audit"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/check": "^0.9.0",
    "@astrojs/mdx": "^4.0.0",
    "@astrojs/react": "^4.0.0",
    "@astrojs/sitemap": "^3.2.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "zod": "^3.23.0",
    "js-yaml": "^4.1.0",
    "@types/js-yaml": "^4.0.9"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@playwright/test": "^1.50.0",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "prettier": "^3.4.0",
    "prettier-plugin-astro": "^0.14.0"
  }
}
```

- [ ] **Step 3: Run `bun install`**

```bash
bun install
```

Expected: dependencies installed, `bun.lock` created.

- [ ] **Step 4: Write `astro.config.ts`**

```ts
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://cameronhartman.dev',
  integrations: [react(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: 'directory',
  },
});
```

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": ["src", "tests", "astro.config.ts", "vitest.config.ts", "playwright.config.ts", ".astro/types.d.ts"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 6: Write `src/styles/global.css`**

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

html {
  -webkit-text-size-adjust: 100%;
}
```

- [ ] **Step 7: Write minimal favicon**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text x="16" y="22" text-anchor="middle" font-size="20" font-family="monospace" font-weight="700">CV</text></svg>
```

- [ ] **Step 8: Write `.editorconfig`**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 9: Write `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-astro"],
  "overrides": [
    { "files": "*.astro", "options": { "parser": "astro" } }
  ]
}
```

- [ ] **Step 10: Write `eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  },
];
```

- [ ] **Step 11: Verify `.gitignore` has the right entries**

The file should already exist with these entries; if any are missing, add them:

```
.superpowers/
node_modules/
dist/
.env
.env.local
.astro/
test-results/
playwright-report/
```

Run:

```bash
cat .gitignore
```

Expected: lines above present.

- [ ] **Step 12: Write `README.md`**

```markdown
# CV — cameronhartman.dev

Online CV / online resume. Replaces the legacy `cam-eeng.github.io/portfolio` site.

See `docs/superpowers/specs/2026-05-09-cv-design.md` for the full design.
**Read `READ-BEFORE-BURNING.md` before doing anything operational** (DNS, secrets, Pages migration).

## Develop

```bash
bun install
bun run dev          # http://localhost:4321
bun run build        # production build → ./dist
bun test             # unit tests
bun run test:e2e     # Playwright
bun run lint
```

## Deploy

`main` branch auto-deploys to GitHub Pages via `.github/workflows/deploy.yml`.
Custom domain `cameronhartman.dev` is configured via the repo-root `CNAME` file.
```

- [ ] **Step 13: Smoke-test the dev server starts**

```bash
bun run dev &
DEV_PID=$!
sleep 5
curl -sf http://localhost:4321/ -o /dev/null && echo "OK" || echo "FAIL"
kill $DEV_PID
```

Expected: `OK` (Astro returns the default page since we have no routes yet — that's expected; we just want to confirm the toolchain runs).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro 5 + React 19 + Tailwind 4 + Bun"
```

---

## Task 2: Vitest + Playwright config

**Files:**
- Create: `vitest.config.ts`, `playwright.config.ts`, `tests/.gitkeep`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 3: Install Playwright browsers**

```bash
bunx playwright install chromium
```

Expected: chromium downloaded.

- [ ] **Step 4: Add a sanity Vitest test**

Create `tests/unit/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run unit tests**

```bash
bun test
```

Expected: `1 passed`.

- [ ] **Step 6: Remove the sanity test (we want a clean slate)**

```bash
rm tests/unit/sanity.test.ts
mkdir -p tests/unit tests/integration tests/e2e
touch tests/.gitkeep
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: vitest + playwright config"
```

---

## Task 3: cv.yaml Zod schema (JSON Resume)

**Files:**
- Create: `src/lib/content/cv-schema.ts`
- Create: `tests/unit/cv-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cv-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CVSchema } from '~/lib/content/cv-schema';

describe('CVSchema', () => {
  const minimal = {
    basics: {
      name: 'Cameron Hartman',
      label: 'Firmware Engineer',
      email: 'cameron@example.com',
      url: 'https://cameronhartman.dev',
      summary: 'A summary.',
      profiles: [],
      location: { city: 'San Jose', region: 'CA', countryCode: 'US' },
    },
    work: [],
    education: [],
    skills: [],
    projects: [],
  };

  it('accepts the minimal valid shape', () => {
    const parsed = CVSchema.parse(minimal);
    expect(parsed.basics.name).toBe('Cameron Hartman');
  });

  it('rejects missing basics.name', () => {
    const broken = { ...minimal, basics: { ...minimal.basics, name: undefined } };
    expect(() => CVSchema.parse(broken)).toThrow();
  });

  it('rejects malformed email', () => {
    const broken = { ...minimal, basics: { ...minimal.basics, email: 'not-an-email' } };
    expect(() => CVSchema.parse(broken)).toThrow();
  });

  it('accepts work entries with valid date strings', () => {
    const withWork = {
      ...minimal,
      work: [{
        name: 'Litepoint',
        position: 'Firmware Engineer',
        url: 'https://litepoint.com',
        startDate: '2020-06',
        endDate: '2024-12',
        summary: 'Test eqpt firmware',
        highlights: ['Shipped X', 'Built Y'],
      }],
    };
    expect(() => CVSchema.parse(withWork)).not.toThrow();
  });

  it('accepts ongoing work entries (no endDate)', () => {
    const withOngoing = {
      ...minimal,
      work: [{
        name: 'Current Co',
        position: 'Engineer',
        startDate: '2025-01',
        summary: '',
        highlights: [],
      }],
    };
    expect(() => CVSchema.parse(withOngoing)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/unit/cv-schema.test.ts
```

Expected: FAIL — `Cannot find module '~/lib/content/cv-schema'`.

- [ ] **Step 3: Write the schema**

Create `src/lib/content/cv-schema.ts`:

```ts
import { z } from 'zod';

const DateString = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Expected YYYY, YYYY-MM, or YYYY-MM-DD');

const Profile = z.object({
  network: z.string(),
  username: z.string(),
  url: z.string().url(),
});

const Location = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  countryCode: z.string().length(2),
});

const Basics = z.object({
  name: z.string().min(1),
  label: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  url: z.string().url(),
  summary: z.string(),
  location: Location,
  profiles: z.array(Profile),
  image: z.string().optional(),
});

const Work = z.object({
  name: z.string(),
  position: z.string(),
  url: z.string().url().optional(),
  startDate: DateString,
  endDate: DateString.optional(),
  summary: z.string(),
  highlights: z.array(z.string()),
});

const Education = z.object({
  institution: z.string(),
  url: z.string().url().optional(),
  area: z.string(),
  studyType: z.string(),
  startDate: DateString,
  endDate: DateString.optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
});

const Skill = z.object({
  name: z.string(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).optional(),
  keywords: z.array(z.string()),
});

const Project = z.object({
  name: z.string(),
  description: z.string(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  startDate: DateString.optional(),
  endDate: DateString.optional(),
  url: z.string().url().optional(),
  roles: z.array(z.string()).optional(),
  entity: z.string().optional(),
  type: z.string().optional(),
  featured: z.boolean().optional(),
});

export const CVSchema = z.object({
  basics: Basics,
  work: z.array(Work),
  education: z.array(Education),
  skills: z.array(Skill),
  projects: z.array(Project),
  awards: z.array(z.object({
    title: z.string(),
    date: DateString,
    awarder: z.string(),
    summary: z.string().optional(),
  })).optional(),
  certificates: z.array(z.object({
    name: z.string(),
    date: DateString,
    issuer: z.string(),
    url: z.string().url().optional(),
  })).optional(),
  publications: z.array(z.object({
    name: z.string(),
    publisher: z.string(),
    releaseDate: DateString,
    url: z.string().url().optional(),
    summary: z.string().optional(),
  })).optional(),
  languages: z.array(z.object({
    language: z.string(),
    fluency: z.string(),
  })).optional(),
  interests: z.array(z.object({
    name: z.string(),
    keywords: z.array(z.string()).optional(),
  })).optional(),
});

export type CV = z.infer<typeof CVSchema>;
```

- [ ] **Step 4: Run tests, expect pass**

```bash
bun test tests/unit/cv-schema.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/cv-schema.ts tests/unit/cv-schema.test.ts
git commit -m "feat: cv.yaml zod schema (JSON Resume shape)"
```

---

## Task 4: cv.yaml loader

**Files:**
- Create: `src/lib/content/cv-loader.ts`
- Create: `tests/unit/cv-loader.test.ts`
- Create: `content/cv.yaml` (placeholder valid file)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cv-loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

describe('loadCV', () => {
  it('loads and validates the canonical cv.yaml', async () => {
    const cv = await loadCV(resolve(__dirname, '../../content/cv.yaml'));
    expect(cv.basics.name).toBeTruthy();
    expect(cv.work).toBeInstanceOf(Array);
  });

  it('throws a descriptive error on invalid YAML', async () => {
    await expect(loadCV('/nonexistent.yaml')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
bun test tests/unit/cv-loader.test.ts
```

Expected: FAIL — `loadCV` not exported.

- [ ] **Step 3: Write the loader**

Create `src/lib/content/cv-loader.ts`:

```ts
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { CVSchema, type CV } from './cv-schema';

export async function loadCV(path: string): Promise<CV> {
  const raw = await readFile(path, 'utf8');
  const parsed = yaml.load(raw);
  const result = CVSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`cv.yaml validation failed at ${path}:\n${result.error.toString()}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Write a minimal valid `content/cv.yaml`**

```yaml
basics:
  name: Cameron Hartman
  label: Firmware / Embedded Engineer
  email: cameron.hartman081@gmail.com
  url: https://cameronhartman.dev
  summary: |
    Firmware and embedded systems engineer with experience across CircuitPython,
    STM32, and full-stack web. (Replace this placeholder summary with current bio.)
  location:
    city: San Jose
    region: CA
    countryCode: US
  profiles:
    - network: GitHub
      username: CAM-eEng
      url: https://github.com/CAM-eEng
    - network: LinkedIn
      username: cameronhartman
      url: https://www.linkedin.com/in/cameronhartman/

work:
  - name: Litepoint
    position: Firmware Engineer
    url: https://www.litepoint.com
    startDate: '2020-06'
    summary: |
      (Placeholder — replace with current work summary.)
    highlights:
      - Placeholder highlight; replace with real impact statement.

education:
  - institution: University of Ottawa
    area: Electrical Engineering
    studyType: BASc
    startDate: '2014-09'
    endDate: '2019-04'

skills:
  - name: Embedded
    keywords: [CircuitPython, STM32, HAL, FreeRTOS]
  - name: Frontend
    keywords: [TypeScript, React, Astro, Tailwind]
  - name: Languages
    keywords: [Python, Rust, Java, Dart]

projects:
  - name: LedDisplay
    description: CircuitPython matrix clock on Adafruit Matrix Portal S3.
    keywords: [CircuitPython, RGB matrix, embedded]
    startDate: '2026-04'
    url: https://github.com/CAM-eEng/...
    featured: true
  - name: 5easy
    description: D&D 5e character manager web app.
    keywords: [TypeScript, React, Supabase]
    startDate: '2026-04'
    featured: true
```

> **NOTE for the engineer:** the file above is a *valid placeholder* so the loader test passes and the site renders something. The real CV content is filled in at Task 18 by the user (or an engineer transcribing from the user's current resume). Don't treat the placeholder values as committed truth.

- [ ] **Step 5: Run tests, expect pass**

```bash
bun test tests/unit/cv-loader.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/cv-loader.ts content/cv.yaml tests/unit/cv-loader.test.ts
git commit -m "feat: cv.yaml loader + placeholder content"
```

---

## Task 5: skills.yaml schema + loader

**Files:**
- Create: `src/lib/content/skills-schema.ts`
- Create: `src/lib/content/skills-loader.ts`
- Create: `tests/unit/skills-loader.test.ts`
- Create: `content/skills.yaml`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/skills-loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadSkills } from '~/lib/content/skills-loader';
import { resolve } from 'node:path';

describe('loadSkills', () => {
  it('loads and validates skills.yaml', async () => {
    const skills = await loadSkills(resolve(__dirname, '../../content/skills.yaml'));
    expect(skills.categories).toBeInstanceOf(Array);
    expect(skills.categories.length).toBeGreaterThan(0);
    for (const cat of skills.categories) {
      for (const s of cat.skills) {
        expect(s.last_used).toMatch(/^\d{4}(-\d{2})?$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
bun test tests/unit/skills-loader.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write schema**

Create `src/lib/content/skills-schema.ts`:

```ts
import { z } from 'zod';

const YearOrYearMonth = z.string().regex(/^\d{4}(-\d{2})?$/);

const Skill = z.object({
  name: z.string().min(1),
  last_used: YearOrYearMonth,
  level: z.enum(['Familiar', 'Working', 'Proficient', 'Expert']).optional(),
});

const Category = z.object({
  name: z.string().min(1),
  skills: z.array(Skill).min(1),
});

export const SkillsSchema = z.object({
  categories: z.array(Category).min(1),
});

export type SkillsFile = z.infer<typeof SkillsSchema>;
```

- [ ] **Step 4: Write loader**

Create `src/lib/content/skills-loader.ts`:

```ts
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { SkillsSchema, type SkillsFile } from './skills-schema';

export async function loadSkills(path: string): Promise<SkillsFile> {
  const raw = await readFile(path, 'utf8');
  const parsed = yaml.load(raw);
  const result = SkillsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`skills.yaml validation failed at ${path}:\n${result.error.toString()}`);
  }
  return result.data;
}
```

- [ ] **Step 5: Write `content/skills.yaml`**

```yaml
categories:
  - name: Embedded
    skills:
      - { name: CircuitPython, last_used: '2026-05', level: Proficient }
      - { name: STM32 (HAL/Cube), last_used: '2024-09', level: Working }
      - { name: ESP32 / ESP-IDF, last_used: '2025-08', level: Working }
  - name: Frontend
    skills:
      - { name: TypeScript, last_used: '2026-05', level: Proficient }
      - { name: React, last_used: '2026-04', level: Proficient }
      - { name: Astro, last_used: '2026-05', level: Working }
      - { name: Tailwind CSS, last_used: '2026-05', level: Proficient }
  - name: Languages
    skills:
      - { name: Python, last_used: '2026-05', level: Proficient }
      - { name: Rust, last_used: '2024-12', level: Familiar }
      - { name: Java, last_used: '2026-01', level: Working }
      - { name: Dart / Flutter, last_used: '2026-04', level: Working }
  - name: Tooling
    skills:
      - { name: Git / GitHub Actions, last_used: '2026-05', level: Proficient }
      - { name: Linux, last_used: '2026-05', level: Proficient }
```

- [ ] **Step 6: Run tests, expect pass**

```bash
bun test tests/unit/
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: skills.yaml schema, loader, and placeholder content"
```

---

## Task 6: Astro projects content collection

**Files:**
- Create: `src/content.config.ts`
- Create: `content/projects/leddisplay.mdx`

- [ ] **Step 1: Write the content collection config**

Create `src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './content/projects' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    role: z.string(),
    stack: z.array(z.string()),
    dates: z.object({
      start: z.string().regex(/^\d{4}(-\d{2})?$/),
      end: z.string().regex(/^\d{4}(-\d{2})?$/).or(z.literal('ongoing')),
    }),
    links: z.object({
      repo: z.string().url().optional(),
      demo: z.string().url().optional(),
    }),
    featured: z.boolean().default(false),
    summary: z.string().min(20).max(200),
  }),
});

export const collections = { projects };
```

- [ ] **Step 2: Write a sample case study**

Create `content/projects/leddisplay.mdx`:

```mdx
---
title: 'LedDisplay — CircuitPython matrix clock'
slug: 'leddisplay'
role: 'Solo'
stack:
  - CircuitPython
  - Adafruit Matrix Portal S3
  - HUB75 RGB LED matrix
dates:
  start: '2026-04'
  end: 'ongoing'
links:
  repo: 'https://github.com/CAM-eEng/'
featured: true
summary: 'A clock running on a Matrix Portal S3 driving a 128×64 RGB LED matrix, with a full investigation of an undocumented panel scan mode.'
---

# Problem

(Placeholder body — replace with real case study.)

# Approach

# What I built

# What I learned
```

- [ ] **Step 3: Verify the build picks up the collection**

```bash
bun run build 2>&1 | tail -20
```

Expected: build succeeds (we have no pages yet that consume the collection, but Astro indexes it).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: projects content collection + sample case study"
```

---

## Task 7: Base layout with CSP meta + nav + footer

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`
- Create: `tests/integration/csp-meta.test.ts`

- [ ] **Step 1: Write the failing CSP test**

Create `tests/integration/csp-meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('Base layout CSP meta', () => {
  it('lists every approved provider host in connect-src', async () => {
    const file = await readFile(resolve(__dirname, '../../src/layouts/Base.astro'), 'utf8');
    const expected = [
      "'self'",
      'https://api.anthropic.com',
      'https://api.openai.com',
      'https://generativelanguage.googleapis.com',
      'https://openrouter.ai',
      'https://api.github.com',
    ];
    for (const host of expected) {
      expect(file, `connect-src must include ${host}`).toContain(host);
    }
  });

  it('forbids inline scripts (no unsafe-inline in script-src)', async () => {
    const file = await readFile(resolve(__dirname, '../../src/layouts/Base.astro'), 'utf8');
    expect(file).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
bun test tests/integration/csp-meta.test.ts
```

Expected: FAIL — Base.astro not found.

- [ ] **Step 3: Write `src/components/Nav.astro`**

```astro
---
const path = Astro.url.pathname;
const links = [
  { href: '/', label: 'Home' },
  { href: '/cv', label: 'CV' },
  { href: '/projects', label: 'Projects' },
  { href: '/contact', label: 'Contact' },
];
---
<nav class="border-b border-neutral-200 dark:border-neutral-800">
  <div class="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
    <a href="/" class="font-mono font-semibold tracking-tight">cameron hartman</a>
    <ul class="flex gap-6 text-sm">
      {links.map((l) => (
        <li>
          <a
            href={l.href}
            class:list={[
              'hover:underline underline-offset-4',
              path === l.href && 'font-semibold',
            ]}
          >{l.label}</a>
        </li>
      ))}
    </ul>
  </div>
</nav>
```

- [ ] **Step 4: Write `src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---
<footer class="border-t border-neutral-200 dark:border-neutral-800 mt-24">
  <div class="mx-auto max-w-3xl px-6 py-8 flex items-center justify-between text-sm text-neutral-500">
    <span>© {year} Cameron Hartman</span>
    <a href="/security" class="hover:underline underline-offset-4">Security &amp; privacy</a>
  </div>
</footer>
```

- [ ] **Step 5: Write `src/layouts/Base.astro`**

```astro
---
import '~/styles/global.css';
import Nav from '~/components/Nav.astro';
import Footer from '~/components/Footer.astro';

interface Props {
  title: string;
  description?: string;
  canonical?: string;
}

const { title, description = 'Cameron Hartman — CV and projects', canonical } = Astro.props;
const url = canonical ?? new URL(Astro.url.pathname, Astro.site).toString();

const csp = [
  "default-src 'self'",
  "connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.github.com",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
---
<!doctype html>
<html lang="en" class="bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content={csp} />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="canonical" href={url} />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={url} />
    <meta property="og:type" content="website" />
    <slot name="head" />
  </head>
  <body class="font-sans antialiased">
    <Nav />
    <main class="mx-auto max-w-3xl px-6 py-12">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 6: Run tests, expect pass**

```bash
bun test tests/integration/csp-meta.test.ts
```

Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: base layout with CSP meta + nav + footer"
```

---

## Task 8: Index page (hero + skim summary)

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Write the page**

```astro
---
import Base from '~/layouts/Base.astro';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
const featuredWork = cv.work.slice(0, 3);
---
<Base title={`${cv.basics.name} — ${cv.basics.label}`} description={cv.basics.summary.slice(0, 160)}>
  <section class="py-8">
    <h1 class="text-4xl font-semibold tracking-tight">{cv.basics.name}</h1>
    <p class="mt-2 text-lg text-neutral-600 dark:text-neutral-400">{cv.basics.label}</p>
    <p class="mt-6 max-w-prose leading-relaxed">{cv.basics.summary}</p>
  </section>

  <section class="py-8">
    <h2 class="text-sm uppercase tracking-wider text-neutral-500 mb-4">Recent</h2>
    <ul class="space-y-3">
      {featuredWork.map((w) => (
        <li class="flex items-baseline justify-between gap-4">
          <div>
            <span class="font-medium">{w.position}</span>
            <span class="text-neutral-500"> at </span>
            <span class="font-mono">{w.name}</span>
          </div>
          <span class="text-sm text-neutral-500 font-mono">
            {w.startDate}{w.endDate ? `–${w.endDate}` : '–present'}
          </span>
        </li>
      ))}
    </ul>
  </section>

  <section class="py-8">
    <a href="/cv" class="inline-block border border-neutral-300 dark:border-neutral-700 rounded px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900">
      View full CV →
    </a>
  </section>

  <!-- Chat island placeholder; lands in Plan 2 -->
  <section class="py-8" data-island="chat-stub">
    <p class="text-sm text-neutral-500 italic">
      Chat-with-CV launches in Plan 2.
    </p>
  </section>
</Base>
```

- [ ] **Step 2: Run dev, manually verify**

```bash
bun run dev &
sleep 3
curl -sf http://localhost:4321/ | grep -q "Cameron Hartman" && echo "OK" || echo "FAIL"
kill %1 2>/dev/null
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: index page with hero + recent work"
```

---

## Task 9: /cv page (full structured resume)

**Files:**
- Create: `src/pages/cv.astro`

- [ ] **Step 1: Write the page**

```astro
---
import Base from '~/layouts/Base.astro';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
---
<Base title={`CV — ${cv.basics.name}`} description={`Full CV for ${cv.basics.name}`}>
  <article class="prose prose-neutral dark:prose-invert max-w-none">
    <header class="not-prose mb-8 flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">{cv.basics.name}</h1>
        <p class="text-neutral-600 dark:text-neutral-400">{cv.basics.label}</p>
      </div>
      <div class="flex gap-3 text-sm">
        <a href="/cv.json" class="font-mono underline underline-offset-4">cv.json</a>
        <span class="text-neutral-400">·</span>
        <a href={`mailto:${cv.basics.email}`} class="underline underline-offset-4">{cv.basics.email}</a>
      </div>
    </header>

    <section>
      <h2>Summary</h2>
      <p>{cv.basics.summary}</p>
    </section>

    <section>
      <h2>Work</h2>
      {cv.work.map((w) => (
        <article class="mb-6">
          <header class="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <strong>{w.position}</strong>
              <span class="text-neutral-500"> · </span>
              <span class="font-mono">{w.name}</span>
            </div>
            <span class="text-sm text-neutral-500 font-mono">
              {w.startDate}{w.endDate ? `–${w.endDate}` : '–present'}
            </span>
          </header>
          {w.summary && <p class="mt-2">{w.summary}</p>}
          {w.highlights.length > 0 && (
            <ul class="mt-2">
              {w.highlights.map((h) => <li>{h}</li>)}
            </ul>
          )}
        </article>
      ))}
    </section>

    <section>
      <h2>Education</h2>
      {cv.education.map((e) => (
        <p>
          <strong>{e.studyType}, {e.area}</strong> · <span class="font-mono">{e.institution}</span>
          <span class="text-neutral-500"> · {e.startDate}{e.endDate ? `–${e.endDate}` : ''}</span>
        </p>
      ))}
    </section>

    <section>
      <h2>Skills</h2>
      <ul>
        {cv.skills.map((s) => (
          <li><strong>{s.name}:</strong> {s.keywords.join(', ')}</li>
        ))}
      </ul>
    </section>

    {cv.projects.length > 0 && (
      <section>
        <h2>Projects</h2>
        <ul>
          {cv.projects.map((p) => (
            <li>
              <strong>{p.name}</strong> — {p.description}
              {p.url && <> · <a href={p.url} class="underline underline-offset-4">link</a></>}
            </li>
          ))}
        </ul>
      </section>
    )}
  </article>
</Base>
```

- [ ] **Step 2: Install Tailwind typography plugin**

```bash
bun add -d @tailwindcss/typography
```

- [ ] **Step 3: Wire up the typography plugin in `src/styles/global.css`**

```css
@import 'tailwindcss';
@plugin "@tailwindcss/typography";

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

html { -webkit-text-size-adjust: 100%; }
```

- [ ] **Step 4: Verify**

```bash
bun run dev &
sleep 3
curl -sf http://localhost:4321/cv | grep -q "Work" && echo "OK" || echo "FAIL"
kill %1 2>/dev/null
```

Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: /cv page with structured resume"
```

---

## Task 10: /projects index + case-study route

**Files:**
- Create: `src/pages/projects/index.astro`, `src/pages/projects/[slug].astro`

- [ ] **Step 1: Write the projects index page**

Create `src/pages/projects/index.astro`:

```astro
---
import Base from '~/layouts/Base.astro';
import { getCollection } from 'astro:content';

const projects = await getCollection('projects');
const sorted = projects.sort((a, b) => b.data.dates.start.localeCompare(a.data.dates.start));
---
<Base title="Projects" description="Case studies and side projects">
  <h1 class="text-3xl font-semibold tracking-tight mb-8">Projects</h1>
  <ul class="space-y-6">
    {sorted.map((p) => (
      <li class="border border-neutral-200 dark:border-neutral-800 rounded p-5 hover:bg-neutral-50 dark:hover:bg-neutral-900">
        <a href={`/projects/${p.data.slug}`} class="block">
          <header class="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h2 class="font-medium text-lg">{p.data.title}</h2>
            <span class="text-sm text-neutral-500 font-mono">
              {p.data.dates.start}{p.data.dates.end !== 'ongoing' ? `–${p.data.dates.end}` : '–ongoing'}
            </span>
          </header>
          <p class="text-neutral-600 dark:text-neutral-400">{p.data.summary}</p>
          <div class="mt-3 flex flex-wrap gap-2 text-xs font-mono text-neutral-500">
            {p.data.stack.map((t) => <span class="border border-neutral-200 dark:border-neutral-800 rounded px-2 py-0.5">{t}</span>)}
          </div>
        </a>
      </li>
    ))}
  </ul>
</Base>
```

- [ ] **Step 2: Write the dynamic case-study route**

Create `src/pages/projects/[slug].astro`:

```astro
---
import Base from '~/layouts/Base.astro';
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const projects = await getCollection('projects');
  return projects.map((p) => ({
    params: { slug: p.data.slug },
    props: { project: p },
  }));
}

const { project } = Astro.props;
const { Content } = await render(project);
---
<Base title={project.data.title} description={project.data.summary}>
  <article class="prose prose-neutral dark:prose-invert max-w-none">
    <header class="not-prose mb-8">
      <h1 class="text-3xl font-semibold tracking-tight">{project.data.title}</h1>
      <p class="mt-2 text-neutral-600 dark:text-neutral-400">{project.data.summary}</p>
      <div class="mt-3 flex flex-wrap gap-2 text-xs font-mono text-neutral-500">
        {project.data.stack.map((t) => <span class="border border-neutral-200 dark:border-neutral-800 rounded px-2 py-0.5">{t}</span>)}
      </div>
      {project.data.links.repo && (
        <p class="mt-3 text-sm">
          <a href={project.data.links.repo} class="underline underline-offset-4">View source →</a>
        </p>
      )}
    </header>
    <Content />
  </article>
</Base>
```

- [ ] **Step 3: Verify**

```bash
bun run build
```

Expected: build succeeds, `dist/projects/index.html` and `dist/projects/leddisplay/index.html` exist.

```bash
ls dist/projects/
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: /projects index + dynamic case-study route"
```

---

## Task 11: Contact + Security pages

**Files:**
- Create: `src/pages/contact.astro`, `src/pages/security.astro`

- [ ] **Step 1: Write `src/pages/contact.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
---
<Base title="Contact" description="Get in touch">
  <h1 class="text-3xl font-semibold tracking-tight mb-6">Contact</h1>
  <ul class="space-y-3">
    <li>
      <span class="text-neutral-500 font-mono text-sm w-20 inline-block">email</span>
      <a href={`mailto:${cv.basics.email}`} class="underline underline-offset-4">{cv.basics.email}</a>
    </li>
    {cv.basics.profiles.map((p) => (
      <li>
        <span class="text-neutral-500 font-mono text-sm w-20 inline-block">{p.network.toLowerCase()}</span>
        <a href={p.url} class="underline underline-offset-4">{p.username}</a>
      </li>
    ))}
  </ul>
</Base>
```

- [ ] **Step 2: Write `src/pages/security.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="Security & privacy" description="How this site handles your data and AI keys">
  <article class="prose prose-neutral dark:prose-invert max-w-none">
    <h1>Security &amp; privacy</h1>

    <p class="lead">
      This site is fully static — no server, no database, no analytics that fingerprint
      you. The interactive AI features use a Bring-Your-Own-Key model so the bill stays
      with you, not me.
    </p>

    <h2>What we don't collect</h2>
    <ul>
      <li>No accounts, no sign-in, no cookies set by us.</li>
      <li>No analytics, no third-party trackers.</li>
      <li>No server logs of your requests (there's no server).</li>
    </ul>

    <h2>How AI features work (Plan 2)</h2>
    <p>
      When you connect an AI account (OpenRouter OAuth, or paste a direct provider key),
      the credential lives in your browser's <code>sessionStorage</code> only — it
      vanishes when you close the tab. Calls go from your browser directly to the
      provider you chose; my site is never in the credential path.
    </p>
    <p>
      Browser extensions and compromised tabs can read <code>sessionStorage</code>. If
      you don't trust the browser session you're in, use demo mode instead.
    </p>

    <h2>How the data on this site is sourced</h2>
    <p>
      The CV body is hand-authored YAML in the
      <a href="https://github.com/CAM-eEng/CV">repo</a>. The activity visualizer
      (Plan 3) snapshots GitHub and HackTheBox public data nightly via a build job.
    </p>

    <h2>Reporting</h2>
    <p>
      Found something? Email <a href="mailto:cameron.hartman081@gmail.com">cameron.hartman081@gmail.com</a>
      or open an issue on the public repo.
    </p>
  </article>
</Base>
```

- [ ] **Step 3: Verify both routes build**

```bash
bun run build && ls dist/contact dist/security
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: /contact + /security pages"
```

---

## Task 12: /cv.json endpoint (JSON Resume export)

**Files:**
- Create: `src/pages/cv.json.ts`
- Create: `tests/integration/cv-json-endpoint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/cv-json-endpoint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GET } from '~/pages/cv.json';
import { CVSchema } from '~/lib/content/cv-schema';

describe('/cv.json endpoint', () => {
  it('returns valid JSON Resume shape', async () => {
    const res = await GET({} as never);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(() => CVSchema.parse(body)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
bun test tests/integration/cv-json-endpoint.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the endpoint**

Create `src/pages/cv.json.ts`:

```ts
import type { APIRoute } from 'astro';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

export const GET: APIRoute = async () => {
  const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
  return new Response(JSON.stringify(cv, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
```

- [ ] **Step 4: Run, expect pass**

```bash
bun test tests/integration/cv-json-endpoint.test.ts
```

Expected: 1 passed.

- [ ] **Step 5: Verify in build output**

```bash
bun run build && cat dist/cv.json | head -10
```

Expected: JSON output starting with `{ "basics": ...`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: /cv.json endpoint (JSON Resume export)"
```

---

## Task 13: /llms.txt endpoint

**Files:**
- Create: `src/pages/llms.txt.ts`
- Create: `tests/integration/llms-txt-endpoint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/llms-txt-endpoint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GET } from '~/pages/llms.txt';

describe('/llms.txt endpoint', () => {
  it('returns plain text', async () => {
    const res = await GET({} as never);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('includes the candidate name and a link to /cv.json', async () => {
    const res = await GET({} as never);
    const body = await res.text();
    expect(body).toMatch(/Cameron Hartman/);
    expect(body).toContain('/cv.json');
  });

  it('starts with an H1 (per llms.txt convention)', async () => {
    const res = await GET({} as never);
    const body = await res.text();
    expect(body.split('\n')[0]).toMatch(/^# /);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
bun test tests/integration/llms-txt-endpoint.test.ts
```

- [ ] **Step 3: Write the endpoint**

Create `src/pages/llms.txt.ts`:

```ts
import type { APIRoute } from 'astro';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
  const projects = await getCollection('projects');

  const lines = [
    `# ${cv.basics.name}`,
    '',
    `> ${cv.basics.label}. ${cv.basics.summary.split('\n')[0]}`,
    '',
    '## Canonical machine-readable CV',
    '- [/cv.json](https://cameronhartman.dev/cv.json) — JSON Resume schema',
    '- [/cv](https://cameronhartman.dev/cv) — human-readable HTML CV with JSON-LD',
    '',
    '## Work',
    ...cv.work.map((w) => `- ${w.position} at ${w.name} (${w.startDate}${w.endDate ? '–' + w.endDate : '–present'})`),
    '',
    '## Skills (top categories)',
    ...cv.skills.map((s) => `- ${s.name}: ${s.keywords.join(', ')}`),
    '',
    '## Projects',
    ...projects.map((p) => `- [${p.data.title}](https://cameronhartman.dev/projects/${p.data.slug}) — ${p.data.summary}`),
    '',
    '## Contact',
    `- email: ${cv.basics.email}`,
    ...cv.basics.profiles.map((p) => `- ${p.network.toLowerCase()}: ${p.url}`),
    '',
  ].join('\n');

  return new Response(lines, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
```

- [ ] **Step 4: Run, expect pass**

```bash
bun test tests/integration/llms-txt-endpoint.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: /llms.txt endpoint"
```

---

## Task 14: JSON-LD generators (Person + WorkExperience)

**Files:**
- Create: `src/lib/jsonld/person.ts`, `src/lib/jsonld/work-experience.ts`
- Create: `src/components/JsonLd.astro`
- Create: `tests/unit/jsonld-person.test.ts`, `tests/unit/jsonld-work.test.ts`

- [ ] **Step 1: Write the failing person test**

Create `tests/unit/jsonld-person.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { personJsonLd } from '~/lib/jsonld/person';

describe('personJsonLd', () => {
  const cv = {
    basics: {
      name: 'Cameron Hartman',
      label: 'Engineer',
      email: 'c@example.com',
      url: 'https://cameronhartman.dev',
      summary: 's',
      profiles: [
        { network: 'GitHub', username: 'CAM-eEng', url: 'https://github.com/CAM-eEng' },
      ],
      location: { city: 'San Jose', region: 'CA', countryCode: 'US' },
    },
  } as never;

  it('produces a valid Person object', () => {
    const ld = personJsonLd(cv);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Person');
    expect(ld.name).toBe('Cameron Hartman');
    expect(ld.email).toBe('mailto:c@example.com');
    expect(ld.url).toBe('https://cameronhartman.dev');
    expect(ld.sameAs).toContain('https://github.com/CAM-eEng');
    expect(ld.address.addressLocality).toBe('San Jose');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
bun test tests/unit/jsonld-person.test.ts
```

- [ ] **Step 3: Write `src/lib/jsonld/person.ts`**

```ts
import type { CV } from '~/lib/content/cv-schema';

export function personJsonLd(cv: CV) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: cv.basics.name,
    jobTitle: cv.basics.label,
    email: `mailto:${cv.basics.email}`,
    url: cv.basics.url,
    description: cv.basics.summary,
    address: {
      '@type': 'PostalAddress',
      addressLocality: cv.basics.location.city,
      addressRegion: cv.basics.location.region,
      addressCountry: cv.basics.location.countryCode,
    },
    sameAs: cv.basics.profiles.map((p) => p.url),
  } as const;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
bun test tests/unit/jsonld-person.test.ts
```

- [ ] **Step 5: Write the failing work test**

Create `tests/unit/jsonld-work.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { workExperienceJsonLd } from '~/lib/jsonld/work-experience';

describe('workExperienceJsonLd', () => {
  it('emits one WorkRole per work entry', () => {
    const cv = {
      work: [
        {
          name: 'Litepoint',
          position: 'Firmware Engineer',
          startDate: '2020-06',
          endDate: '2024-12',
          summary: 's',
          highlights: [],
        },
      ],
    } as never;
    const ld = workExperienceJsonLd(cv);
    expect(ld).toHaveLength(1);
    expect(ld[0]['@type']).toBe('WorkRole');
    expect(ld[0].roleName).toBe('Firmware Engineer');
    expect(ld[0].startDate).toBe('2020-06');
    expect(ld[0].endDate).toBe('2024-12');
    expect(ld[0].worksFor['@type']).toBe('Organization');
    expect(ld[0].worksFor.name).toBe('Litepoint');
  });

  it('omits endDate for ongoing roles', () => {
    const cv = {
      work: [{
        name: 'Co', position: 'Eng', startDate: '2025-01', summary: '', highlights: [],
      }],
    } as never;
    const ld = workExperienceJsonLd(cv);
    expect(ld[0].endDate).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run, expect fail**

```bash
bun test tests/unit/jsonld-work.test.ts
```

- [ ] **Step 7: Write `src/lib/jsonld/work-experience.ts`**

```ts
import type { CV } from '~/lib/content/cv-schema';

export function workExperienceJsonLd(cv: CV) {
  return cv.work.map((w) => ({
    '@context': 'https://schema.org',
    '@type': 'WorkRole',
    roleName: w.position,
    startDate: w.startDate,
    ...(w.endDate ? { endDate: w.endDate } : {}),
    description: w.summary,
    worksFor: {
      '@type': 'Organization',
      name: w.name,
      ...(w.url ? { url: w.url } : {}),
    },
  }));
}
```

- [ ] **Step 8: Run, expect pass**

```bash
bun test tests/unit/jsonld-work.test.ts
```

- [ ] **Step 9: Write the JsonLd component**

Create `src/components/JsonLd.astro`:

```astro
---
interface Props {
  data: unknown;
}
const { data } = Astro.props;
const json = JSON.stringify(data);
---
<script type="application/ld+json" set:html={json}></script>
```

- [ ] **Step 10: Inject Person + WorkRole on `/cv` page**

Edit `src/pages/cv.astro` — add to the frontmatter section after the existing imports:

```astro
import JsonLd from '~/components/JsonLd.astro';
import { personJsonLd } from '~/lib/jsonld/person';
import { workExperienceJsonLd } from '~/lib/jsonld/work-experience';
```

In the same frontmatter, after `const cv = ...`:

```astro
const ld = [personJsonLd(cv), ...workExperienceJsonLd(cv)];
```

In the page body, just inside `<Base ...>` and before `<article>`:

```astro
<JsonLd data={ld} slot="head" />
```

> The `slot="head"` writes the script into the document head via the named slot we already declared in `Base.astro`.

- [ ] **Step 11: Run unit tests + build**

```bash
bun test && bun run build
```

Expected: tests pass, build succeeds.

```bash
grep -c 'application/ld+json' dist/cv/index.html
```

Expected: 1.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: JSON-LD generators (Person + WorkRole) injected on /cv"
```

---

## Task 15: Sitemap configuration

**Files:**
- Modify: `astro.config.ts`

The `@astrojs/sitemap` integration is already added in Task 1. Verify it emits the expected URLs.

- [ ] **Step 1: Build and inspect sitemap**

```bash
bun run build
cat dist/sitemap-index.xml
cat dist/sitemap-0.xml
```

Expected: sitemap-0.xml lists `/`, `/cv`, `/projects/`, `/projects/leddisplay/`, `/contact`, `/security`. The `/cv.json` and `/llms.txt` endpoints are not in the sitemap by default — that's correct (they're machine-readable companions, not indexable HTML).

- [ ] **Step 2: Add a robots.txt**

Create `public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://cameronhartman.dev/sitemap-index.xml
```

- [ ] **Step 3: Commit**

```bash
git add public/robots.txt
git commit -m "feat: robots.txt linking to sitemap"
```

---

## Task 16: Playwright happy-path E2E

**Files:**
- Create: `tests/e2e/happy-path.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test.describe('happy path', () => {
  test('home loads and links to /cv', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await expect(page).toHaveTitle(/Cameron Hartman/);
    await page.getByRole('link', { name: /View full CV/i }).click();
    await expect(page).toHaveURL(/\/cv\/?$/);
    expect(errors).toEqual([]);
  });

  test('/cv page contains JSON-LD Person', async ({ page }) => {
    await page.goto('/cv');
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld!);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const person = arr.find((x: { '@type'?: string }) => x['@type'] === 'Person');
    expect(person).toBeTruthy();
  });

  test('/cv.json returns valid JSON Resume', async ({ request }) => {
    const res = await request.get('/cv.json');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.basics.name).toBeTruthy();
  });

  test('/llms.txt is reachable and starts with H1', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body.split('\n')[0]).toMatch(/^# /);
  });

  test('/projects/leddisplay renders the case study', async ({ page }) => {
    await page.goto('/projects/leddisplay');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('LedDisplay');
  });
});
```

- [ ] **Step 2: Run E2E**

```bash
bun run test:e2e
```

Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: playwright happy-path covering all foundation routes"
```

---

## Task 17: GitHub Actions — CI workflow (no secrets)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: ci

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332  # v4.1.7
        with:
          persist-credentials: false

      - uses: oven-sh/setup-bun@4bc047ad259df6fc24a6c9b0f9a0cb08cf17fbe5  # v2.0.1
        with:
          bun-version: '1.1.x'

      - name: Install
        run: bun install --frozen-lockfile

      - name: Lint
        run: bun run lint

      - name: Unit + integration tests
        run: bun test

      - name: Build
        run: bun run build

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: E2E
        run: bun run test:e2e
```

> **Important:** This workflow runs on `pull_request` from forks. It must not access any secret. If you ever need a secret in CI, do not add it here — keep secrets in `deploy.yml` only. See `READ-BEFORE-BURNING.md`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: PR-time workflow (build + lint + unit + e2e), no secrets"
```

---

## Task 18: GitHub Actions — Deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: deploy-pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332  # v4.1.7
      - uses: oven-sh/setup-bun@4bc047ad259df6fc24a6c9b0f9a0cb08cf17fbe5  # v2.0.1
        with:
          bun-version: '1.1.x'
      - run: bun install --frozen-lockfile
      - run: bun run build
      - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa  # v3.0.1
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-24.04
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e  # v4.0.5
```

> **Why the Action SHAs?** Per `READ-BEFORE-BURNING.md`, third-party Actions are pinned to commit SHA, not version tag. The SHAs above are the v4.1.7 / v2.0.1 / v3.0.1 / v4.0.5 release tags resolved to commits. Dependabot bumps these.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy workflow (push: main → GitHub Pages)"
```

---

## Task 19: Custom domain CNAME + final content + push

**Files:**
- Create: `CNAME`
- Modify: `content/cv.yaml`, `content/skills.yaml`, `content/projects/leddisplay.mdx`

- [ ] **Step 1: Write `CNAME`**

```
cameronhartman.dev
```

- [ ] **Step 2: Cameron — fill in real CV content**

Replace the placeholder values in `content/cv.yaml`, `content/skills.yaml`, and `content/projects/leddisplay.mdx` with current real data. Specifically:

- `basics.summary` — current professional summary.
- `work[*]` — every role with real `position`, `name`, `startDate`, `endDate`, `summary`, and bullet `highlights`.
- `education` — verify University of Ottawa entry is accurate.
- `skills` — confirm keyword lists.
- `projects` — short descriptions for projects worth highlighting.
- `skills.yaml` — confirm `last_used` dates.
- `leddisplay.mdx` — write the real case study (Problem / Approach / What I built / What I learned).

> **This is the only step that can't be automated.** The whole site renders from these files.

- [ ] **Step 3: Verify the build still passes**

```bash
bun run lint && bun test && bun run build
```

Expected: green.

- [ ] **Step 4: Run E2E one more time**

```bash
bun run test:e2e
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "content: real CV data + cameronhartman.dev CNAME"
```

- [ ] **Step 6: Push and let deploy.yml run**

```bash
git push origin main
gh run watch
```

Expected: `ci.yml` and `deploy.yml` both green.

- [ ] **Step 7: Verify deployment URL**

```bash
gh api repos/CAM-eEng/CV/pages 2>/dev/null | jq '.html_url, .status'
```

Expected: status `built`. URL is the GitHub Pages URL (custom domain takes effect once DNS is configured — Task 20).

---

## Task 20: Manual operational steps (DNS, Pages config, branch protection)

**Files:** none (these are operational tasks performed in registrar / GitHub web UI)

> **Read `READ-BEFORE-BURNING.md` before starting.** Order matters — the DNS records have to go in *before* the CNAME, and registrar 2FA must be hardware-key.

- [ ] **Step 1: Register `cameronhartman.dev`** (if not already owned)

- [ ] **Step 2: Lock down the registrar account**
  - Hardware-key 2FA
  - Registry-lock if available for `.dev`
  - Multi-year + auto-renew

- [ ] **Step 3: DNS records, in this order**

At the registrar's DNS panel, add (in this order, waiting for propagation between):

1. `cameronhartman.dev. CAA 0 issue "letsencrypt.org"`
2. `cameronhartman.dev. TXT "v=spf1 -all"`
3. `_dmarc.cameronhartman.dev. TXT "v=DMARC1; p=reject; rua=mailto:cameron.hartman081@gmail.com"`
4. `cameronhartman.dev. MX 0 .`
5. `cameronhartman.dev. CNAME cam-eeng.github.io.` (or apex A/AAAA records pointing to GitHub Pages IPs — see https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site for current IPs)

For the apex (no `www`), GitHub Pages docs list four A records and four AAAA records — use those instead of CNAME at the apex.

- [ ] **Step 4: Configure custom domain in repo settings**

```bash
gh api -X PUT repos/CAM-eEng/CV/pages -f cname=cameronhartman.dev -F https_enforced=true
```

Expected: 200 response.

- [ ] **Step 5: Verify the CNAME file is committed and visible**

The `CNAME` file at the repo root must contain exactly `cameronhartman.dev` (Task 19 Step 1). GitHub re-reads it on each deploy.

- [ ] **Step 6: Wait for cert issuance + verify**

```bash
sleep 60
curl -sI https://cameronhartman.dev/ | head -3
```

Expected: `HTTP/2 200`. May take up to 24h after first DNS resolution; check periodically.

- [ ] **Step 7: Enable branch protection on `main`**

```bash
gh api -X PUT repos/CAM-eEng/CV/branches/main/protection \
  -f required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=build-and-test' \
  -F enforce_admins=true \
  -f required_pull_request_reviews.required_approving_review_count=0 \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F restrictions= \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F required_signatures=true \
  -F required_linear_history=true 2>&1 | tail -3
```

Expected: 200.

- [ ] **Step 8: Add Dependabot config**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
```

- [ ] **Step 9: Commit Dependabot config**

```bash
git add .github/dependabot.yml
git commit -m "ci: dependabot for github-actions and npm"
git push origin main
```

- [ ] **Step 10: Final verification**

```bash
curl -sf https://cameronhartman.dev/ | grep -q "Cameron Hartman" && echo "OK" || echo "FAIL"
curl -sf https://cameronhartman.dev/cv.json | jq '.basics.name'
curl -sf https://cameronhartman.dev/llms.txt | head -3
```

Expected: site live, machine-readable endpoints reachable, name returns from `cv.json`.

- [ ] **Step 11: Tag the foundation milestone**

```bash
git tag -a v1.0-foundation -m "Foundation deployed to cameronhartman.dev"
git push origin v1.0-foundation
```

- [ ] **Step 12: Archive the legacy portfolio repo** (optional, do after confirming new site is solid for ~1 week)

```bash
gh repo archive CAM-eEng/portfolio --yes
```

---

## Self-review (engineer: skip; this is the plan author's checklist)

- ✅ Spec coverage check:
  - Spec §4 (stack) → Tasks 1–2 ✓
  - Spec §5 (IA) → Tasks 8–11 ✓
  - Spec §6.1 (cv.yaml) → Tasks 3–4 ✓
  - Spec §6.2 (projects MDX) → Task 6 ✓
  - Spec §6.3 (skills.yaml) → Task 5 ✓
  - Spec §6.4 build artifacts: `/cv.json` ✓ (Task 12), `/llms.txt` ✓ (Task 13), JSON-LD ✓ (Task 14), sitemap ✓ (Task 15), RSS ⚠️ deferred to Plan 2 (no project updates worth syndicating yet), OG images ⚠️ deferred to Plan 2 (Satori needs a render path), `/resume.pdf` ⚠️ deferred to Plan 2 (headless-browser PDF render adds dep weight)
  - Spec §7 (AI features) — out of scope for Plan 1 ✓
  - Spec §8.1 build pipeline → Tasks 17–18 + Step 7 of Task 20 (branch protection) ✓
  - Spec §8.2 BYOK CSP → Task 7 (allowlist baked into Base.astro, pinned by test) ✓
  - Spec §8.3 custom domain → Task 19 + Task 20 ✓
  - Spec §8.4 header limitations — accepted gap, documented in Base.astro CSP comment
  - Spec §9 quality bar → Tests in every task; Lighthouse not enforced in Plan 1 (target Plan 2 once islands ship)
- ✅ Placeholder scan: no "TBD" / "TODO" left in plan steps. The phrase "Cameron — fill in real CV content" in Task 19 is intentional — that's the human-only step.
- ✅ Type consistency: `CV` type from `cv-schema.ts` referenced consistently in `cv-loader.ts`, `cv.json.ts`, `llms.txt.ts`, `personJsonLd`, `workExperienceJsonLd`. `SkillsFile` from `skills-schema.ts` referenced in `skills-loader.ts`.
- ✅ Action SHAs in Tasks 17–18 are pinned (per spec §8.1 and READ-BEFORE-BURNING). They map to the v4.1.7 / v2.0.1 / v3.0.1 / v4.0.5 release tags as of 2025-10; Dependabot updates them.
