# CV AI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three Bring-Your-Own-Key AI features described in spec §7 — Chat-with-CV, JD analyzer, and the BYOK connection sheet that fronts them — onto the existing CV site at cameronhartman.dev, with zero Cameron-side inference cost.

**Architecture:** A pluggable `AIProvider` interface with four concrete implementations: OpenRouter (PKCE OAuth), Anthropic (paste-key), OpenAI (paste-key), and Demo (pre-baked SSE streams). Visitors connect once via a bottom sheet; the credential lives in `sessionStorage` only. All inference calls go browser → provider directly (no Cameron-side proxy) using Vercel AI SDK 5 client primitives. The full CV (~25k tokens) is stuffed into a cached system prompt rather than vectorized — caching makes follow-up turns cheap and surfaces an AI-literacy design choice ("we don't need a vector DB").

**Tech Stack:** Vercel AI SDK 5 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`), DOMPurify, React 19 islands, Zod (for JD-analyzer structured output), the existing Astro/Tailwind/shadcn substrate from Plan 1.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-09-cv-design.md` (§7 and §8.2 are in scope)
- Pre-action checklist: `READ-BEFORE-BURNING.md` (CSP allowlist update rule is the most relevant)
- Plan 1 (already shipped): `docs/superpowers/plans/2026-05-09-cv-foundation.md`

---

## File structure (locked here)

```
src/
├── lib/
│   ├── ai/
│   │   ├── provider.ts          # AIProvider interface + ChatChunk/Message types
│   │   ├── session.ts           # BYOK sessionStorage wrapper (read/write/clear)
│   │   ├── system-prompt.ts     # build cached system prompt from cv.yaml
│   │   ├── citations.ts         # parse [work.0.highlights.2] → /cv anchor
│   │   ├── demo.ts              # DemoProvider: pre-baked streamed answers
│   │   ├── anthropic.ts         # AnthropicProvider: direct browser → api.anthropic.com
│   │   ├── openai.ts            # OpenAIProvider: direct browser → api.openai.com
│   │   ├── openrouter-pkce.ts   # PKCE helpers (code verifier/challenge, state)
│   │   ├── openrouter.ts        # OpenRouterProvider: OAuth/PKCE + browser calls
│   │   ├── registry.ts          # active-provider selector backed by session.ts
│   │   └── jd-schema.ts         # Zod schema for JD-analyzer structured output
│   └── markdown/
│       └── safe.tsx             # DOMPurify-wrapped markdown renderer (React)
├── components/
│   ├── byok/
│   │   ├── ConnectSheet.tsx     # bottom-sheet with 3 options
│   │   ├── KeyPasteForm.tsx     # paste-key flow (Anthropic / OpenAI)
│   │   └── ProviderStatus.tsx   # "Connected · OpenRouter" + Disconnect button
│   ├── chat/
│   │   ├── Chat.tsx             # composed chat island
│   │   ├── Message.tsx          # one message bubble (assistant uses safe md)
│   │   ├── InputBox.tsx         # textarea + submit
│   │   └── CacheStat.tsx        # "cached: 24,891 tokens" pill
│   └── jd-analyzer/
│       ├── JDAnalyzer.tsx       # composed JD-analyzer island
│       ├── ScoreGauge.tsx       # radial fit-score gauge
│       └── ResultCard.tsx       # matched/gaps/intro rendering
├── pages/
│   ├── playground.astro         # /playground — hosts Chat and JDAnalyzer islands
│   ├── oauth/
│   │   └── callback.astro       # /oauth/callback — handles PKCE return
│   └── index.astro              # MODIFY: replace chat-stub with real Chat island
└── tests/
    ├── unit/
    │   ├── ai-session.test.ts
    │   ├── ai-system-prompt.test.ts
    │   ├── ai-citations.test.ts
    │   ├── ai-demo-provider.test.ts
    │   ├── ai-anthropic-provider.test.ts
    │   ├── ai-openai-provider.test.ts
    │   ├── ai-openrouter-pkce.test.ts
    │   ├── ai-openrouter-provider.test.ts
    │   ├── ai-registry.test.ts
    │   ├── jd-schema.test.ts
    │   └── markdown-safe.test.tsx
    └── e2e/
        ├── chat-demo.spec.ts
        ├── byok-connect-sheet.spec.ts
        └── jd-analyzer-demo.spec.ts
```

**Splitting rationale.**
- One file per provider — each is independent and isolated for swap-out.
- PKCE helpers separated from `openrouter.ts` so the crypto/state logic can be unit-tested without touching network.
- React islands stay thin: `Chat.tsx` composes `Message`/`InputBox`/`CacheStat`; logic lives in `lib/ai/`.
- `markdown/safe.tsx` exports a single `<SafeMarkdown content={...} />` component so its DOMPurify policy has exactly one home.

---

## Decisions baked in

- **Vercel AI SDK 5** is the abstraction for streaming, tool-use, and structured-output. Each provider implementation creates an SDK `LanguageModel` configured with the visitor's credential and the right base URL; our `AIProvider.chat()` returns the SDK's stream wrapped in our `ChatChunk` shape so the islands depend only on our interface.
- **CV is stuffed into the system prompt, not RAG'd.** It is approximately 25k tokens and fits well inside cached context windows. Caching is provider-specific:
  - Anthropic: explicit `cache_control: { type: 'ephemeral' }` on the system block.
  - OpenAI: automatic for system+prefix ≥ 1024 tokens.
  - OpenRouter: pass-through to underlying provider via SDK.
- **`sessionStorage` only.** Keys never touch `localStorage`. There is a single read/write/clear API in `lib/ai/session.ts` so we can pin the behavior with one test.
- **CSP allowlist already correct** (set in Plan 1 Task 7 with `connect-src` including `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, `openrouter.ai`, `api.github.com`, `self`). The integration test from Plan 1 stops us drifting it.
- **Demo mode** returns artificial streamed chunks at realistic cadence (one token-ish blob every ~25 ms) so the UI behaves identically to a real provider. Source of canned content lives in `lib/ai/demo.ts`.
- **OpenRouter OAuth uses PKCE with S256**. The authorization endpoint is `https://openrouter.ai/auth` and the token endpoint is `https://openrouter.ai/api/v1/auth/keys`. Callback URL: `https://cameronhartman.dev/oauth/callback`.
- **JD analyzer uses Vercel AI SDK's `generateObject`** with a Zod schema — every provider supports structured outputs through the SDK.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `bun.lock`

- [ ] **Step 1: Install runtime + dev deps**

```bash
PATH="$HOME/.bun/bin:$PATH" bun add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/openai-compatible dompurify isomorphic-dompurify marked
PATH="$HOME/.bun/bin:$PATH" bun add -d @types/dompurify @testing-library/react @testing-library/jest-dom jsdom
```

`ai` is Vercel AI SDK 5 core; `@ai-sdk/anthropic`, `@ai-sdk/openai`, and `@ai-sdk/openai-compatible` are the per-provider integrations (OpenRouter uses the openai-compatible adapter). `dompurify` + `isomorphic-dompurify` give us safe HTML in both server-rendered Astro (build time, JSDOM) and client React (browser DOM). `marked` is a lightweight markdown-to-HTML pass that runs *before* DOMPurify.

`@testing-library/react` and `jsdom` let us unit-test React components and DOM-using code under Vitest.

- [ ] **Step 2: Pin the versions in `package.json`**

After install, the resulting `package.json` `dependencies` block should include (versions resolved by Bun — accept whatever bun chose, they'll be `^x.y.z` ranges):
- `ai`
- `@ai-sdk/anthropic`
- `@ai-sdk/openai`
- `@ai-sdk/openai-compatible`
- `dompurify`
- `isomorphic-dompurify`
- `marked`

And `devDependencies`:
- `@types/dompurify`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`

- [ ] **Step 3: Update `vitest.config.ts` to enable jsdom for component tests**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

This enables Jest-DOM matchers like `toBeInTheDocument()` in Vitest.

- [ ] **Step 5: Verify nothing broke**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: lint exit 0, all 17 Plan 1 tests still pass (cv-loader uses node fs; jsdom doesn't break it because node's fs and path are still available through Vite's node alias), build exit 0.

If `cv-loader.test.ts` breaks because `readFile` isn't available in jsdom, switch `environment: 'jsdom'` back to `'node'` and add `// @vitest-environment jsdom` directive on top of the test files that need it (see Task 6 onward).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock vitest.config.ts tests/setup.ts
git commit -m "$(cat <<'EOF'
chore: add Vercel AI SDK, DOMPurify, markdown + testing-library deps

Foundation for Plan 2 (AI features). vitest.config switched to jsdom
so React component tests can run; node-env behavior preserved via
per-file directive where needed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: AIProvider interface + types

**Files:**
- Create: `src/lib/ai/provider.ts`

This task only defines the contract — no implementation. There are no tests yet because there's nothing to test; concrete provider tests in Tasks 4, 8, 9, 11 exercise the interface.

- [ ] **Step 1: Write `src/lib/ai/provider.ts`**

```ts
export type ProviderId = 'openrouter' | 'anthropic' | 'openai' | 'demo';

export interface ModelInfo {
  id: string;             // provider-native model id, e.g. 'claude-opus-4-7'
  label: string;          // human-friendly name
  contextWindow: number;  // tokens
  supportsCaching: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatChunk =
  | { type: 'text'; delta: string }
  | { type: 'cache-info'; cachedTokens: number }
  | { type: 'done'; totalTokens: number };

export interface ChatOpts {
  messages: ChatMessage[];
  model?: string;         // defaults to provider's default
  signal?: AbortSignal;
}

export interface StructuredOpts<T> {
  prompt: string;
  schema: import('zod').ZodSchema<T>;
  model?: string;
  signal?: AbortSignal;
}

export interface AIProvider {
  id: ProviderId;
  displayName: string;
  models: ModelInfo[];
  defaultModel: string;

  chat(opts: ChatOpts): AsyncIterable<ChatChunk>;
  structured<T>(opts: StructuredOpts<T>): Promise<T>;

  /**
   * Number of tokens that were cache-hit on the most recent call.
   * Returns 0 if caching wasn't used or no calls have been made.
   */
  lastCachedTokens(): number;
}
```

- [ ] **Step 2: Lint**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/provider.ts
git commit -m "feat: AIProvider interface + types"
```

---

## Task 3: BYOK session storage

**Files:**
- Create: `src/lib/ai/session.ts`, `tests/unit/ai-session.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/ai-session.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { readSession, writeSession, clearSession, type Session } from '~/lib/ai/session';

describe('BYOK session storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(readSession()).toBeNull();
  });

  it('round-trips a session', () => {
    const s: Session = { providerId: 'anthropic', token: 'sk-ant-***', model: 'claude-opus-4-7' };
    writeSession(s);
    expect(readSession()).toEqual(s);
  });

  it('clear removes the session', () => {
    writeSession({ providerId: 'demo', token: '', model: 'demo' });
    clearSession();
    expect(readSession()).toBeNull();
  });

  it('never writes to localStorage', () => {
    writeSession({ providerId: 'openai', token: 'sk-***', model: 'gpt-4o' });
    expect(localStorage.length).toBe(0);
  });

  it('returns null on corrupted JSON', () => {
    sessionStorage.setItem('byok-session', '{not valid json');
    expect(readSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-session.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/session.ts`**

```ts
import type { ProviderId } from './provider';

const KEY = 'byok-session';

export interface Session {
  providerId: ProviderId;
  token: string;
  model: string;
}

export function readSession(): Session | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.providerId || typeof parsed.token !== 'string' || !parsed.model) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-session.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/session.ts tests/unit/ai-session.test.ts
git commit -m "feat(ai): BYOK session storage (sessionStorage only)"
```

---

## Task 4: System prompt builder

**Files:**
- Create: `src/lib/ai/system-prompt.ts`, `tests/unit/ai-system-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-system-prompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import type { CV } from '~/lib/content/cv-schema';

const cv: CV = {
  basics: {
    name: 'Cameron Hartman',
    label: 'Software Engineer',
    email: 'c@example.com',
    url: 'https://cameronhartman.dev',
    summary: 'Engineer.',
    location: { city: 'San Jose', region: 'CA', countryCode: 'US' },
    profiles: [],
  },
  work: [
    {
      name: 'LitePoint',
      position: 'Engineer',
      startDate: '2020-07',
      summary: 'Test eqpt firmware.',
      highlights: ['Built X', 'Shipped Y'],
    },
  ],
  education: [],
  skills: [{ name: 'Embedded', keywords: ['C++', 'Python'] }],
  projects: [],
};

describe('buildSystemPrompt', () => {
  it('includes the candidate name and role', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt).toContain('Cameron Hartman');
    expect(prompt).toContain('Software Engineer');
  });

  it('includes every work entry with citation keys', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt).toContain('LitePoint');
    expect(prompt).toContain('[work.0.highlights.0]');
    expect(prompt).toContain('[work.0.highlights.1]');
  });

  it('instructs the model to refuse off-topic questions', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt.toLowerCase()).toMatch(/only answer.+cameron|refuse.+off-topic|stay on topic/);
  });

  it('instructs the model to cite using bracketed keys', () => {
    const prompt = buildSystemPrompt(cv);
    expect(prompt).toMatch(/\[work\.\d+\.highlights\.\d+\]/);
    expect(prompt.toLowerCase()).toMatch(/cite|citation/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-system-prompt.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/system-prompt.ts`**

```ts
import type { CV } from '~/lib/content/cv-schema';

export function buildSystemPrompt(cv: CV): string {
  const workSection = cv.work
    .map((w, wi) => {
      const highlights = w.highlights
        .map((h, hi) => `  - [work.${wi}.highlights.${hi}] ${h}`)
        .join('\n');
      const period = w.endDate ? `${w.startDate}–${w.endDate}` : `${w.startDate}–present`;
      return [
        `### ${w.position} at ${w.name} (${period})`,
        w.summary,
        highlights,
      ].join('\n');
    })
    .join('\n\n');

  const skillsSection = cv.skills
    .map((s, i) => `- [skills.${i}] ${s.name}: ${s.keywords.join(', ')}`)
    .join('\n');

  const projectsSection = cv.projects
    .map((p, i) => `- [projects.${i}] ${p.name} — ${p.description}`)
    .join('\n');

  return `You are an assistant grounded in the resume of ${cv.basics.name}, a ${cv.basics.label}. \
Answer only questions about ${cv.basics.name}'s professional background, skills, and projects. \
Refuse off-topic questions politely and redirect to the resume.

When you reference a specific fact, cite the source using its bracketed key (e.g. [work.0.highlights.1]). \
Always cite. If a fact is not in the resume below, say so — do not invent details.

## Summary
${cv.basics.summary}

## Work history
${workSection}

## Skills
${skillsSection}

## Projects
${projectsSection}
`;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-system-prompt.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/system-prompt.ts tests/unit/ai-system-prompt.test.ts
git commit -m "feat(ai): system prompt builder with citation keys + refusal directive"
```

---

## Task 5: Citation parser

**Files:**
- Create: `src/lib/ai/citations.ts`, `tests/unit/ai-citations.test.ts`

The model emits bracket-keys like `[work.0.highlights.2]` inline in its text. This task converts those to anchor links into the rendered `/cv` page so visitors can click through to the source.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-citations.test.ts
import { describe, it, expect } from 'vitest';
import { rewriteCitations, parseCitationKey } from '~/lib/ai/citations';

describe('parseCitationKey', () => {
  it('parses work-highlight keys', () => {
    expect(parseCitationKey('work.0.highlights.2')).toEqual({
      type: 'work-highlight',
      workIndex: 0,
      highlightIndex: 2,
    });
  });

  it('parses skill keys', () => {
    expect(parseCitationKey('skills.3')).toEqual({ type: 'skill', skillIndex: 3 });
  });

  it('returns null for unknown shapes', () => {
    expect(parseCitationKey('garbage')).toBeNull();
    expect(parseCitationKey('work.0')).toBeNull();
  });
});

describe('rewriteCitations', () => {
  it('replaces bracketed keys with markdown anchors', () => {
    const out = rewriteCitations('Built X [work.0.highlights.1] and shipped Y [work.0.highlights.2].');
    expect(out).toContain('[¹](/cv/#work-0-highlights-1)');
    expect(out).toContain('[²](/cv/#work-0-highlights-2)');
  });

  it('numbers citations in document order, deduping repeats', () => {
    const out = rewriteCitations('[work.0.highlights.0] and again [work.0.highlights.0].');
    expect(out.match(/¹/g)?.length).toBe(2);
    expect(out).not.toContain('²');
  });

  it('leaves unrelated bracket-like text alone', () => {
    const out = rewriteCitations('Square brackets [like this] should stay.');
    expect(out).toContain('[like this]');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-citations.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/citations.ts`**

```ts
export type CitationKey =
  | { type: 'work-highlight'; workIndex: number; highlightIndex: number }
  | { type: 'skill'; skillIndex: number }
  | { type: 'project'; projectIndex: number };

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function toSuperscript(n: number): string {
  return String(n).split('').map((d) => SUPERSCRIPTS[Number(d)]).join('');
}

const KEY_RE = /^(work|skills|projects)\.(\d+)(?:\.([a-z]+)\.(\d+))?$/;

export function parseCitationKey(key: string): CitationKey | null {
  const m = key.match(KEY_RE);
  if (!m) return null;
  const [, top, idx1, _sub, idx2] = m;
  if (top === 'work' && _sub === 'highlights' && idx2 !== undefined) {
    return { type: 'work-highlight', workIndex: Number(idx1), highlightIndex: Number(idx2) };
  }
  if (top === 'skills' && _sub === undefined) {
    return { type: 'skill', skillIndex: Number(idx1) };
  }
  if (top === 'projects' && _sub === undefined) {
    return { type: 'project', projectIndex: Number(idx1) };
  }
  return null;
}

const BRACKET_RE = /\[([a-z]+(?:\.\d+)?(?:\.[a-z]+\.\d+)?)\]/g;

export function rewriteCitations(text: string): string {
  const seen = new Map<string, number>();
  let counter = 0;
  return text.replace(BRACKET_RE, (full, inner: string) => {
    const parsed = parseCitationKey(inner);
    if (!parsed) return full;
    let num = seen.get(inner);
    if (num === undefined) {
      counter += 1;
      num = counter;
      seen.set(inner, num);
    }
    const anchor = inner.replace(/\./g, '-');
    return `[${toSuperscript(num)}](/cv/#${anchor})`;
  });
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-citations.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Add citation-target IDs to `/cv` page so the anchors resolve**

The anchors point at `/cv/#work-0-highlights-1`. The `cv.astro` page from Plan 1 renders highlights but without IDs. Edit `src/pages/cv.astro` — change the highlights `<li>` rendering to include the citation ID. Locate the existing block:

```astro
{w.highlights.length > 0 && (
  <ul class="mt-2">
    {w.highlights.map((h) => <li>{h}</li>)}
  </ul>
)}
```

Replace with the indexed version (note `cv.work.map((w, wi)` already exists from Plan 1 — if it doesn't, change the outer map too to provide `wi`):

```astro
{w.highlights.length > 0 && (
  <ul class="mt-2">
    {w.highlights.map((h, hi) => (
      <li id={`work-${wi}-highlights-${hi}`} class="scroll-mt-20">{h}</li>
    ))}
  </ul>
)}
```

Verify the outer `cv.work.map((w) => ...)` is updated to `cv.work.map((w, wi) => ...)` if needed. `scroll-mt-20` accounts for the sticky nav so the anchor lands below the header.

- [ ] **Step 6: Rebuild and verify anchors land in HTML**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
grep -E 'id="work-0-highlights-[0-9]+"' dist/cv/index.html | head -5
```

Expected: at least one `id="work-0-highlights-0"` etc. visible.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/citations.ts tests/unit/ai-citations.test.ts src/pages/cv.astro
git commit -m "feat(ai): citation parser + anchor IDs on /cv highlights"
```

---

## Task 6: Safe markdown renderer

**Files:**
- Create: `src/lib/markdown/safe.tsx`, `tests/unit/markdown-safe.test.tsx`

The chat island renders assistant output as markdown. This is the XSS-defense layer.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/markdown-safe.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SafeMarkdown } from '~/lib/markdown/safe';

describe('SafeMarkdown', () => {
  it('renders bold and italic', () => {
    const { container } = render(<SafeMarkdown content="**bold** and _italic_" />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('renders inline code and code blocks', () => {
    const { container } = render(<SafeMarkdown content={'`inline` and\n\n```\nblock\n```'} />);
    expect(container.querySelector('code')?.textContent).toBe('inline');
    expect(container.querySelector('pre code')?.textContent).toMatch(/^block/);
  });

  it('renders links with rel="noopener noreferrer"', () => {
    const { container } = render(<SafeMarkdown content="[home](/cv)" />);
    const a = container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/cv');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('strips <script> tags', () => {
    const { container } = render(<SafeMarkdown content={'<script>alert(1)</script>safe'} />);
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.textContent).toContain('safe');
  });

  it('strips inline event handlers', () => {
    const { container } = render(<SafeMarkdown content={'<img src=x onerror="alert(1)">'} />);
    expect(container.innerHTML).not.toMatch(/onerror=/i);
  });

  it('strips javascript: URLs', () => {
    const { container } = render(<SafeMarkdown content="[bad](javascript:alert(1))" />);
    const a = container.querySelector('a');
    if (a) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    }
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/markdown-safe.test.tsx
```

- [ ] **Step 3: Write `src/lib/markdown/safe.tsx`**

```tsx
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'code', 'pre', 'a',
  'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4',
  'sup', 'sub',
];
const ALLOWED_ATTR = ['href', 'title'];

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement) {
    node.setAttribute('rel', 'noopener noreferrer');
    if (node.getAttribute('target') === '_blank') {
      // keep target, rel already set
    }
  }
});

export function SafeMarkdown({ content }: { content: string }) {
  const rawHtml = marked.parse(content, { async: false }) as string;
  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  return <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

> **Note:** the `dangerouslySetInnerHTML` here is acceptable *only* because the value has been through DOMPurify with a strict allowlist. This is the one place in the codebase where dangerouslySetInnerHTML is allowed; see `READ-BEFORE-BURNING.md`.

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/markdown-safe.test.tsx
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown/safe.tsx tests/unit/markdown-safe.test.tsx
git commit -m "feat: SafeMarkdown — marked + DOMPurify with strict allowlist"
```

---

## Task 7: Demo provider

**Files:**
- Create: `src/lib/ai/demo.ts`, `tests/unit/ai-demo-provider.test.ts`

Demo mode streams pre-baked answers so the chat island has a working backend even when no AI account is connected.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-demo-provider.test.ts
import { describe, it, expect } from 'vitest';
import { DemoProvider } from '~/lib/ai/demo';

async function collect(stream: AsyncIterable<{ type: string; delta?: string }>) {
  const chunks: string[] = [];
  for await (const c of stream) {
    if (c.type === 'text' && c.delta) chunks.push(c.delta);
  }
  return chunks.join('');
}

describe('DemoProvider', () => {
  const provider = new DemoProvider();

  it('has id "demo"', () => {
    expect(provider.id).toBe('demo');
  });

  it('streams a canned answer about embedded experience', async () => {
    const text = await collect(provider.chat({
      messages: [{ role: 'user', content: 'Tell me about Cameron embedded experience' }],
    }));
    expect(text.toLowerCase()).toMatch(/firmware|embedded|circuitpython|stm32/);
  });

  it('streams a canned answer about AI work', async () => {
    const text = await collect(provider.chat({
      messages: [{ role: 'user', content: 'has cameron worked with AI?' }],
    }));
    expect(text.toLowerCase()).toMatch(/regression ai agent|snowflake|azure/);
  });

  it('falls back to a generic answer when no keyword matches', async () => {
    const text = await collect(provider.chat({
      messages: [{ role: 'user', content: 'asldkfjaslkdjfasdf' }],
    }));
    expect(text.length).toBeGreaterThan(20);
  });

  it('emits a final "done" chunk', async () => {
    const events: string[] = [];
    for await (const c of provider.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      events.push(c.type);
    }
    expect(events.at(-1)).toBe('done');
  });

  it('respects AbortSignal mid-stream', async () => {
    const ctrl = new AbortController();
    const iter = provider.chat({ messages: [{ role: 'user', content: 'hi' }], signal: ctrl.signal })[Symbol.asyncIterator]();
    await iter.next(); // first chunk
    ctrl.abort();
    const next = await iter.next();
    expect(next.done || next.value?.type === 'done').toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-demo-provider.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/demo.ts`**

```ts
import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';

const ANSWERS: Array<{ keywords: RegExp; text: string }> = [
  {
    keywords: /\b(ai|llm|machine learning|regression ai agent|snowflake|azure)\b/i,
    text: `At LitePoint, Cameron is leading the engineering team's first AI project — the "Regression AI Agent" — built on Snowflake, Azure Blob Storage, and Python [work.0.highlights.4]. This is a fresh initiative as of 2026 and reflects a broader push at LitePoint into ML-augmented test automation. Cameron's hands-on AI experience pairs with a long firmware background, which gives him an unusual angle: he can connect ML pipelines back to the physical RF test instruments they're meant to support.`,
  },
  {
    keywords: /\b(devops|docker|jenkins|ci|cd)\b/i,
    text: `Cameron drove the LitePoint engineering team's adoption of Docker and worked with Jenkins to automate testing frameworks [work.0.highlights.5]. This was a cross-team initiative, not just personal tooling.`,
  },
  {
    keywords: /\b(linux|toolchain|visual studio|vs studio)\b/i,
    text: `Cameron led the LitePoint engineering team's effort to support Linux natively in the Visual Studio editor [work.0.highlights.6]. That's a non-trivial cross-platform integration effort given how Windows-centric the VS Studio stack has historically been.`,
  },
  {
    keywords: /\b(embedded|firmware|circuitpython|stm32|c\+\+|rf|microcontroller)\b/i,
    text: `Cameron has 6+ years of embedded experience [work.0.highlights.0]. Currently at LitePoint, he designs firmware in C++ for next-gen telecommunications test equipment and runs hardware test/debugging on RF devices from 0–60 GHz using Spectrum Analyzers and VNAs [work.0.highlights.2]. Prior roles include MC Countermeasures (military EW/ECM systems, 2018–2019) and MyPitboard (PCB design + GNSS-GPS data over UART/SPI, 2020).`,
  },
  {
    keywords: /\b(education|degree|school|university|uottawa)\b/i,
    text: `BASc in Electrical Engineering from the University of Ottawa (2014–2018).`,
  },
  {
    keywords: /\b(project|side project|leddisplay|5easy)\b/i,
    text: `Two current side projects worth mentioning: **LedDisplay** (CircuitPython matrix clock on Adafruit Matrix Portal S3, with an investigation of an undocumented HUB75 panel scan mode), and **5easy** (full-stack D&D 5e character manager — TypeScript + Supabase). Earlier academic/work projects include a Qt+Python testing interface for high-power RF amplifiers (2019) and a solar microinverter with software PLL on Arduino Uno (2018).`,
  },
];

const FALLBACK = `I can answer questions about Cameron's work at LitePoint, his earlier hardware/firmware roles (MyPitboard, Tetra Tech, MC Countermeasures), his BASc from the University of Ottawa, and his current AI/DevOps/Linux work and side projects. Try asking about a specific area — embedded experience, AI, DevOps, or a particular role.`;

function pickAnswer(message: string): string {
  for (const a of ANSWERS) if (a.keywords.test(message)) return a.text;
  return FALLBACK;
}

export class DemoProvider implements AIProvider {
  id = 'demo' as const;
  displayName = 'Demo (no key needed)';
  models: ModelInfo[] = [{ id: 'demo', label: 'Demo', contextWindow: 0, supportsCaching: false }];
  defaultModel = 'demo';

  private lastCached = 0;

  async *chat(opts: ChatOpts): AsyncIterable<ChatChunk> {
    const last = opts.messages.findLast?.((m) => m.role === 'user');
    const userMsg = last?.content ?? '';
    const answer = pickAnswer(userMsg);
    const tokens = answer.split(/(\s+)/);
    let total = 0;
    for (const tok of tokens) {
      if (opts.signal?.aborted) break;
      yield { type: 'text', delta: tok };
      total += tok.length;
      await sleep(25);
    }
    yield { type: 'done', totalTokens: total };
  }

  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    // Demo provider returns a fake fit-score JD-analyzer response shape.
    // Callers that want real structured output should connect a real provider.
    const placeholder = {
      fit_score: 72,
      matched_skills: [
        { skill: 'Python', evidence: 'work.0.highlights.1' },
        { skill: 'Docker', evidence: 'work.0.highlights.5' },
      ],
      gaps: ['No specific cloud-native production experience listed'],
      tailored_intro: 'Cameron is a 6-year software engineer with hands-on AI, DevOps, and embedded experience. His current role at LitePoint includes leading their first AI project and driving Docker/Jenkins adoption — directly relevant signals for the role.',
      suggested_questions: ['Can you walk me through the Regression AI Agent architecture?', 'How did you sequence the Docker rollout at LitePoint?'],
    };
    return opts.schema.parse(placeholder);
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-demo-provider.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/demo.ts tests/unit/ai-demo-provider.test.ts
git commit -m "feat(ai): DemoProvider — pre-baked streamed answers + demo structured output"
```

---

## Task 8: Anthropic provider

**Files:**
- Create: `src/lib/ai/anthropic.ts`, `tests/unit/ai-anthropic-provider.test.ts`

- [ ] **Step 1: Write the failing test**

We mock `fetch` to assert request shape and verify response decoding.

```ts
// tests/unit/ai-anthropic-provider.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '~/lib/ai/anthropic';

const ssEvent = (event: string, data: object) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function makeStreamResponse(events: string[]): Response {
  const body = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      for (const e of events) controller.enqueue(enc.encode(e));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => fetchSpy.mockRestore());

describe('AnthropicProvider', () => {
  it('sends API key in x-api-key header and dangerous-browser header', async () => {
    fetchSpy.mockResolvedValue(makeStreamResponse([
      ssEvent('message_start', { message: { usage: { cache_read_input_tokens: 0 } } }),
      ssEvent('message_stop', {}),
    ]));
    const p = new AnthropicProvider('sk-ant-test123');
    for await (const _ of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      // drain
    }
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test123');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['anthropic-version']).toBeTruthy();
  });

  it('decodes content_block_delta chunks into text', async () => {
    fetchSpy.mockResolvedValue(makeStreamResponse([
      ssEvent('content_block_delta', { delta: { type: 'text_delta', text: 'Hello ' } }),
      ssEvent('content_block_delta', { delta: { type: 'text_delta', text: 'world' } }),
      ssEvent('message_stop', {}),
    ]));
    const p = new AnthropicProvider('sk-ant-x');
    let acc = '';
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (c.type === 'text') acc += c.delta;
    }
    expect(acc).toBe('Hello world');
  });

  it('emits cache-info when cache_read_input_tokens > 0', async () => {
    fetchSpy.mockResolvedValue(makeStreamResponse([
      ssEvent('message_start', { message: { usage: { cache_read_input_tokens: 24891, input_tokens: 50 } } }),
      ssEvent('message_stop', {}),
    ]));
    const p = new AnthropicProvider('sk-ant-x');
    const events: Array<{ type: string; cachedTokens?: number }> = [];
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      events.push(c);
    }
    const cache = events.find((e) => e.type === 'cache-info');
    expect(cache?.cachedTokens).toBe(24891);
  });

  it('throws on non-200 response with the API error body', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }));
    const p = new AnthropicProvider('sk-ant-bad');
    await expect(async () => {
      for await (const _ of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
    }).rejects.toThrow(/bad key/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-anthropic-provider.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/anthropic.ts`**

```ts
import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', contextWindow: 200_000, supportsCaching: true },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextWindow: 200_000, supportsCaching: true },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', contextWindow: 200_000, supportsCaching: true },
];

export class AnthropicProvider implements AIProvider {
  id = 'anthropic' as const;
  displayName = 'Anthropic (direct key)';
  models = MODELS;
  defaultModel = 'claude-opus-4-7';

  private lastCached = 0;

  constructor(private apiKey: string, private systemPrompt: string = '') {}

  async *chat(opts: ChatOpts): AsyncIterable<ChatChunk> {
    const body = {
      model: opts.model ?? this.defaultModel,
      max_tokens: 4096,
      stream: true,
      system: this.systemPrompt
        ? [{ type: 'text', text: this.systemPrompt, cache_control: { type: 'ephemeral' } }]
        : undefined,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${txt}`);
    }

    let total = 0;
    for await (const ev of parseSSE(res.body!)) {
      if (ev.event === 'message_start') {
        const usage = ev.data?.message?.usage;
        if (usage?.cache_read_input_tokens) {
          this.lastCached = usage.cache_read_input_tokens;
          yield { type: 'cache-info', cachedTokens: usage.cache_read_input_tokens };
        }
      } else if (ev.event === 'content_block_delta') {
        const d = ev.data?.delta;
        if (d?.type === 'text_delta' && typeof d.text === 'string') {
          total += d.text.length;
          yield { type: 'text', delta: d.text };
        }
      } else if (ev.event === 'message_stop') {
        yield { type: 'done', totalTokens: total };
        return;
      }
    }
  }

  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    // Non-streaming, request JSON output. Validate with the provided schema.
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages: [{ role: 'user', content: opts.prompt + '\n\nRespond with ONLY a JSON object matching the expected shape, no prose.' }],
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`Anthropic structured error (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const text = json.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return opts.schema.parse(JSON.parse(match[0]));
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

interface SSEEvent { event?: string; data?: any }

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncIterable<SSEEvent> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      const ev: SSEEvent = {};
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) ev.event = line.slice(6).trim();
        else if (line.startsWith('data:')) {
          try { ev.data = JSON.parse(line.slice(5).trim()); } catch { /* ignore */ }
        }
      }
      yield ev;
    }
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-anthropic-provider.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/anthropic.ts tests/unit/ai-anthropic-provider.test.ts
git commit -m "feat(ai): AnthropicProvider — direct browser → api.anthropic.com with prompt caching"
```

---

## Task 9: OpenAI provider

**Files:**
- Create: `src/lib/ai/openai.ts`, `tests/unit/ai-openai-provider.test.ts`

Mirrors Task 8 but for OpenAI's API (`https://api.openai.com/v1/chat/completions`, SSE-style chunks with `data: {...}` lines).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-openai-provider.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '~/lib/ai/openai';

function streamRes(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(`data: ${ch}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch'); });
afterEach(() => fetchSpy.mockRestore());

describe('OpenAIProvider', () => {
  it('sends Authorization Bearer header', async () => {
    fetchSpy.mockResolvedValue(streamRes(['{}']));
    const p = new OpenAIProvider('sk-test');
    for await (const _ of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer sk-test');
  });

  it('decodes choices[0].delta.content chunks', async () => {
    fetchSpy.mockResolvedValue(streamRes([
      JSON.stringify({ choices: [{ delta: { content: 'Hello ' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'world' } }] }),
    ]));
    const p = new OpenAIProvider('sk-x');
    let acc = '';
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (c.type === 'text') acc += c.delta;
    }
    expect(acc).toBe('Hello world');
  });

  it('emits cache-info when usage.prompt_tokens_details.cached_tokens > 0', async () => {
    fetchSpy.mockResolvedValue(streamRes([
      JSON.stringify({ choices: [{ delta: { content: 'x' } }], usage: { prompt_tokens_details: { cached_tokens: 1024 } } }),
    ]));
    const p = new OpenAIProvider('sk-x');
    const events: Array<{ type: string; cachedTokens?: number }> = [];
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) events.push(c);
    expect(events.find((e) => e.type === 'cache-info')?.cachedTokens).toBe(1024);
  });

  it('throws on non-200', async () => {
    fetchSpy.mockResolvedValue(new Response('{"error":{"message":"bad"}}', { status: 401 }));
    const p = new OpenAIProvider('sk-bad');
    await expect(async () => {
      for await (const _ of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
    }).rejects.toThrow(/bad/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-openai-provider.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/openai.ts`**

```ts
import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';

const API_URL = 'https://api.openai.com/v1/chat/completions';

const MODELS: ModelInfo[] = [
  { id: 'gpt-5', label: 'GPT-5', contextWindow: 200_000, supportsCaching: true },
  { id: 'gpt-4o', label: 'GPT-4o', contextWindow: 128_000, supportsCaching: true },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', contextWindow: 128_000, supportsCaching: true },
];

export class OpenAIProvider implements AIProvider {
  id = 'openai' as const;
  displayName = 'OpenAI (direct key)';
  models = MODELS;
  defaultModel = 'gpt-4o';

  private lastCached = 0;

  constructor(private apiKey: string, private systemPrompt: string = '') {}

  async *chat(opts: ChatOpts): AsyncIterable<ChatChunk> {
    const messages: Array<{ role: string; content: string }> = [];
    if (this.systemPrompt) messages.push({ role: 'system', content: this.systemPrompt });
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        stream: true,
        stream_options: { include_usage: true },
        messages,
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${await res.text()}`);

    let total = 0;
    for await (const ev of parseOpenAISSE(res.body!)) {
      const delta = ev.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        total += delta.length;
        yield { type: 'text', delta };
      }
      const cached = ev.usage?.prompt_tokens_details?.cached_tokens;
      if (typeof cached === 'number' && cached > 0) {
        this.lastCached = cached;
        yield { type: 'cache-info', cachedTokens: cached };
      }
    }
    yield { type: 'done', totalTokens: total };
  }

  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        messages: [
          ...(this.systemPrompt ? [{ role: 'system', content: this.systemPrompt }] : []),
          { role: 'user', content: opts.prompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`OpenAI structured error (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? '{}';
    return opts.schema.parse(JSON.parse(content));
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

async function* parseOpenAISSE(body: ReadableStream<Uint8Array>): AsyncIterable<any> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') return;
          try { yield JSON.parse(payload); } catch { /* skip */ }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-openai-provider.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/openai.ts tests/unit/ai-openai-provider.test.ts
git commit -m "feat(ai): OpenAIProvider — direct browser → api.openai.com with prompt caching"
```

---

## Task 10: OpenRouter PKCE helpers

**Files:**
- Create: `src/lib/ai/openrouter-pkce.ts`, `tests/unit/ai-openrouter-pkce.test.ts`

PKCE flow primitives: generate code verifier, derive S256 challenge, store/retrieve state, build authorize URL, exchange code for token.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-openrouter-pkce.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateVerifier,
  challengeFromVerifier,
  buildAuthorizeUrl,
  exchangeCode,
  CALLBACK_PATH,
} from '~/lib/ai/openrouter-pkce';

describe('PKCE helpers', () => {
  it('generates a verifier between 43 and 128 chars', () => {
    const v = generateVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('derives a deterministic S256 challenge', async () => {
    const v = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const c1 = await challengeFromVerifier(v);
    const c2 = await challengeFromVerifier(v);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds authorize URL with the right params', () => {
    const url = buildAuthorizeUrl({
      callbackUrl: 'https://cameronhartman.dev/oauth/callback',
      codeChallenge: 'CHAL',
      state: 'STATE123',
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://openrouter.ai/auth');
    expect(u.searchParams.get('callback_url')).toBe('https://cameronhartman.dev/oauth/callback');
    expect(u.searchParams.get('code_challenge')).toBe('CHAL');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe('STATE123');
  });

  it('CALLBACK_PATH is /oauth/callback', () => {
    expect(CALLBACK_PATH).toBe('/oauth/callback');
  });

  describe('exchangeCode', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch'); });
    afterEach(() => fetchSpy.mockRestore());

    it('POSTs code + code_verifier to the token endpoint', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ key: 'sk-or-***' }), { status: 200 }));
      const token = await exchangeCode({ code: 'AUTH_CODE', codeVerifier: 'V' });
      expect(token).toBe('sk-or-***');
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.code).toBe('AUTH_CODE');
      expect(body.code_verifier).toBe('V');
      expect(body.code_challenge_method).toBe('S256');
    });

    it('throws on non-200', async () => {
      fetchSpy.mockResolvedValue(new Response('{"error":"bad"}', { status: 400 }));
      await expect(exchangeCode({ code: 'X', codeVerifier: 'Y' })).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-openrouter-pkce.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/openrouter-pkce.ts`**

```ts
export const CALLBACK_PATH = '/oauth/callback';
const AUTH_URL = 'https://openrouter.ai/auth';
const TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys';

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateVerifier(): string {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr).slice(0, 96);
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const enc = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return base64UrlEncode(new Uint8Array(hash));
}

export function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

export function buildAuthorizeUrl(opts: { callbackUrl: string; codeChallenge: string; state: string }): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set('callback_url', opts.callbackUrl);
  u.searchParams.set('code_challenge', opts.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', opts.state);
  return u.toString();
}

export async function exchangeCode(opts: { code: string; codeVerifier: string }): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: opts.code,
      code_verifier: opts.codeVerifier,
      code_challenge_method: 'S256',
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter token exchange failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  if (!json.key) throw new Error('OpenRouter response missing key');
  return json.key as string;
}

// Storage for PKCE state across the redirect — sessionStorage so it survives the auth bounce.
const VERIFIER_KEY = 'openrouter-pkce-verifier';
const STATE_KEY = 'openrouter-pkce-state';

export function storePendingPkce(verifier: string, state: string): void {
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
}

export function readAndClearPendingPkce(): { verifier: string; state: string } | null {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!verifier || !state) return null;
  return { verifier, state };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-openrouter-pkce.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/openrouter-pkce.ts tests/unit/ai-openrouter-pkce.test.ts
git commit -m "feat(ai): OpenRouter PKCE helpers (verifier/challenge/state/exchange)"
```

---

## Task 11: OpenRouter provider

**Files:**
- Create: `src/lib/ai/openrouter.ts`, `tests/unit/ai-openrouter-provider.test.ts`

OpenRouter is OpenAI-compatible at the API level; we reuse OpenAI's SSE parsing.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-openrouter-provider.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterProvider } from '~/lib/ai/openrouter';

function streamRes(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(`data: ${ch}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch'); });
afterEach(() => fetchSpy.mockRestore());

describe('OpenRouterProvider', () => {
  it('targets openrouter.ai with Authorization Bearer', async () => {
    fetchSpy.mockResolvedValue(streamRes(['{}']));
    const p = new OpenRouterProvider('sk-or-tok');
    for await (const _ of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) { /* drain */ }
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer sk-or-tok');
  });

  it('forwards the model id verbatim (OpenRouter uses prefixed IDs)', async () => {
    fetchSpy.mockResolvedValue(streamRes(['{}']));
    const p = new OpenRouterProvider('sk-or-x');
    for await (const _ of p.chat({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'anthropic/claude-opus-4-7',
    })) { /* drain */ }
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe('anthropic/claude-opus-4-7');
  });

  it('decodes content deltas like OpenAI', async () => {
    fetchSpy.mockResolvedValue(streamRes([
      JSON.stringify({ choices: [{ delta: { content: 'foo' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'bar' } }] }),
    ]));
    const p = new OpenRouterProvider('sk-or-x');
    let acc = '';
    for await (const c of p.chat({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (c.type === 'text') acc += c.delta;
    }
    expect(acc).toBe('foobar');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-openrouter-provider.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/openrouter.ts`**

```ts
import type { AIProvider, ChatChunk, ChatOpts, ModelInfo, StructuredOpts } from './provider';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS: ModelInfo[] = [
  { id: 'google/gemini-2.5-flash-lite:free', label: 'Gemini 2.5 Flash Lite (free)', contextWindow: 1_000_000, supportsCaching: false },
  { id: 'anthropic/claude-opus-4-7', label: 'Claude Opus 4.7', contextWindow: 200_000, supportsCaching: true },
  { id: 'openai/gpt-5', label: 'GPT-5', contextWindow: 200_000, supportsCaching: true },
];

export class OpenRouterProvider implements AIProvider {
  id = 'openrouter' as const;
  displayName = 'OpenRouter';
  models = MODELS;
  defaultModel = 'google/gemini-2.5-flash-lite:free';

  private lastCached = 0;

  constructor(private token: string, private systemPrompt: string = '') {}

  async *chat(opts: ChatOpts): AsyncIterable<ChatChunk> {
    const messages: Array<{ role: string; content: string }> = [];
    if (this.systemPrompt) messages.push({ role: 'system', content: this.systemPrompt });
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
        'HTTP-Referer': 'https://cameronhartman.dev',
        'X-Title': 'Cameron Hartman CV',
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        stream: true,
        messages,
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter API error (${res.status}): ${await res.text()}`);

    let total = 0;
    for await (const ev of parseSSE(res.body!)) {
      const delta = ev.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        total += delta.length;
        yield { type: 'text', delta };
      }
      const cached = ev.usage?.prompt_tokens_details?.cached_tokens ?? ev.usage?.cache_tokens;
      if (typeof cached === 'number' && cached > 0) {
        this.lastCached = cached;
        yield { type: 'cache-info', cachedTokens: cached };
      }
    }
    yield { type: 'done', totalTokens: total };
  }

  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        messages: [
          ...(this.systemPrompt ? [{ role: 'system', content: this.systemPrompt }] : []),
          { role: 'user', content: opts.prompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter structured error (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? '{}';
    return opts.schema.parse(JSON.parse(content));
  }

  lastCachedTokens(): number {
    return this.lastCached;
  }
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncIterable<any> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') return;
          try { yield JSON.parse(payload); } catch { /* skip */ }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-openrouter-provider.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/openrouter.ts tests/unit/ai-openrouter-provider.test.ts
git commit -m "feat(ai): OpenRouterProvider — direct browser via openai-compatible streaming"
```

---

## Task 12: OAuth callback page

**Files:**
- Create: `src/pages/oauth/callback.astro`

- [ ] **Step 1: Write the page**

```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="Signing in…" description="OpenRouter authentication callback">
  <div class="min-h-[40vh] flex items-center justify-center">
    <div class="text-center">
      <p id="status" class="text-neutral-600 dark:text-neutral-400">Finishing OpenRouter sign-in…</p>
      <noscript>
        <p class="mt-2 text-sm text-red-600">JavaScript is required to complete sign-in. <a href="/">Return home</a>.</p>
      </noscript>
    </div>
  </div>

  <script>
    import { exchangeCode, readAndClearPendingPkce } from '~/lib/ai/openrouter-pkce';
    import { writeSession } from '~/lib/ai/session';

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateParam = params.get('state');
    const errParam = params.get('error');

    // Scrub the URL FIRST so the code never appears in browser history beyond this point.
    history.replaceState({}, '', window.location.pathname);

    const status = document.getElementById('status')!;

    if (errParam) {
      status.textContent = `Sign-in failed: ${errParam}. You can close this tab.`;
    } else if (!code || !stateParam) {
      status.textContent = 'Missing authorization code. You can close this tab.';
    } else {
      const pending = readAndClearPendingPkce();
      if (!pending || pending.state !== stateParam) {
        status.textContent = 'Sign-in state mismatch — possible tampering. Aborted.';
      } else {
        try {
          const token = await exchangeCode({ code, codeVerifier: pending.verifier });
          writeSession({ providerId: 'openrouter', token, model: 'google/gemini-2.5-flash-lite:free' });
          status.textContent = 'Connected. Redirecting…';
          setTimeout(() => { window.location.href = '/playground'; }, 600);
        } catch (e) {
          status.textContent = `Sign-in failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
    }
  </script>
</Base>
```

> Important: no analytics, no error trackers, no third-party scripts are imported on this page. The `history.replaceState` call happens *before* any logic that could throw, so the authorization code is removed from the URL even if exchange fails.

- [ ] **Step 2: Build**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
test -f dist/oauth/callback/index.html && echo OK || echo MISSING
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/oauth/callback.astro
git commit -m "feat(ai): OpenRouter OAuth callback page — PKCE exchange + URL scrub"
```

---

## Task 13: Provider registry

**Files:**
- Create: `src/lib/ai/registry.ts`, `tests/unit/ai-registry.test.ts`

Glue: reads the current session and returns the right provider instance. Used by the chat island.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveProvider } from '~/lib/ai/registry';
import { writeSession, clearSession } from '~/lib/ai/session';
import { DemoProvider } from '~/lib/ai/demo';
import { AnthropicProvider } from '~/lib/ai/anthropic';
import { OpenAIProvider } from '~/lib/ai/openai';
import { OpenRouterProvider } from '~/lib/ai/openrouter';

describe('getActiveProvider', () => {
  beforeEach(() => clearSession());

  it('returns DemoProvider when no session is set', () => {
    const p = getActiveProvider('');
    expect(p).toBeInstanceOf(DemoProvider);
  });

  it('returns AnthropicProvider for an anthropic session', () => {
    writeSession({ providerId: 'anthropic', token: 'sk-ant-x', model: 'claude-opus-4-7' });
    const p = getActiveProvider('sys');
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  it('returns OpenAIProvider for an openai session', () => {
    writeSession({ providerId: 'openai', token: 'sk-x', model: 'gpt-4o' });
    expect(getActiveProvider('sys')).toBeInstanceOf(OpenAIProvider);
  });

  it('returns OpenRouterProvider for an openrouter session', () => {
    writeSession({ providerId: 'openrouter', token: 'sk-or-x', model: 'anthropic/claude-opus-4-7' });
    expect(getActiveProvider('sys')).toBeInstanceOf(OpenRouterProvider);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-registry.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/registry.ts`**

```ts
import type { AIProvider } from './provider';
import { readSession } from './session';
import { DemoProvider } from './demo';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';

export function getActiveProvider(systemPrompt: string): AIProvider {
  const s = readSession();
  if (!s) return new DemoProvider();
  switch (s.providerId) {
    case 'anthropic': return new AnthropicProvider(s.token, systemPrompt);
    case 'openai':    return new OpenAIProvider(s.token, systemPrompt);
    case 'openrouter':return new OpenRouterProvider(s.token, systemPrompt);
    case 'demo':      return new DemoProvider();
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/ai-registry.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/registry.ts tests/unit/ai-registry.test.ts
git commit -m "feat(ai): provider registry — session → AIProvider instance"
```

---

## Task 14: Connect sheet component

**Files:**
- Create: `src/components/byok/ConnectSheet.tsx`, `src/components/byok/KeyPasteForm.tsx`, `src/components/byok/ProviderStatus.tsx`

These are React components for the BYOK UX. We test the integrated behavior via Playwright E2E in Task 20; here we keep the code minimal and rely on the shipped Plan 1 CSP/test infrastructure to catch security regressions.

- [ ] **Step 1: Write `src/components/byok/KeyPasteForm.tsx`**

```tsx
import { useState } from 'react';
import { writeSession } from '~/lib/ai/session';
import type { ProviderId } from '~/lib/ai/provider';

interface Props {
  providerId: 'anthropic' | 'openai';
  defaultModel: string;
  onConnected: () => void;
}

export function KeyPasteForm({ providerId, defaultModel, onConnected }: Props) {
  const [key, setKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const placeholder = providerId === 'anthropic' ? 'sk-ant-…' : 'sk-…';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!key) return;
        setSubmitting(true);
        try {
          writeSession({ providerId: providerId as ProviderId, token: key.trim(), model: defaultModel });
          setKey('');
          onConnected();
        } catch (e) {
          setErr(e instanceof Error ? e.message : String(e));
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-3"
    >
      <label className="block text-sm">
        <span className="text-neutral-500">API key</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent font-mono text-sm"
        />
      </label>
      <p className="text-xs text-neutral-500">
        Key stored in <code>sessionStorage</code> only — vanishes when you close the tab.
        Browser extensions and compromised tabs can still read it. Use demo mode if you don't trust this session.
      </p>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={!key || submitting}
        className="px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 disabled:opacity-50"
      >
        {submitting ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write `src/components/byok/ConnectSheet.tsx`**

```tsx
import { useState } from 'react';
import { KeyPasteForm } from './KeyPasteForm';
import { writeSession } from '~/lib/ai/session';
import {
  generateVerifier,
  challengeFromVerifier,
  generateState,
  buildAuthorizeUrl,
  storePendingPkce,
  CALLBACK_PATH,
} from '~/lib/ai/openrouter-pkce';

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

type Mode = 'menu' | 'anthropic' | 'openai';

export function ConnectSheet({ open, onClose, onConnected }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  if (!open) return null;

  async function startOpenRouter() {
    const verifier = generateVerifier();
    const challenge = await challengeFromVerifier(verifier);
    const state = generateState();
    storePendingPkce(verifier, state);
    const url = buildAuthorizeUrl({
      callbackUrl: window.location.origin + CALLBACK_PATH,
      codeChallenge: challenge,
      state,
    });
    window.location.href = url;
  }

  function startDemo() {
    writeSession({ providerId: 'demo', token: '', model: 'demo' });
    onConnected();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-xl sm:rounded-xl p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect to ask</h2>
          <button onClick={onClose} aria-label="Close" className="text-neutral-500">✕</button>
        </div>

        {mode === 'menu' && (
          <div className="space-y-2">
            <button
              onClick={startOpenRouter}
              className="w-full text-left px-4 py-3 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Connect OpenRouter</div>
              <div className="text-xs text-neutral-500">OAuth — many models, free options. Recommended.</div>
            </button>
            <button
              onClick={() => setMode('anthropic')}
              className="w-full text-left px-4 py-3 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Use an Anthropic key</div>
              <div className="text-xs text-neutral-500">Paste your own. Most direct path; key stays in your browser.</div>
            </button>
            <button
              onClick={() => setMode('openai')}
              className="w-full text-left px-4 py-3 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Use an OpenAI key</div>
              <div className="text-xs text-neutral-500">Paste your own. Key stays in your browser.</div>
            </button>
            <button
              onClick={startDemo}
              className="w-full text-left px-4 py-3 rounded border border-dashed border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Try demo mode</div>
              <div className="text-xs text-neutral-500">No key, no calls — pre-baked answers about Cameron.</div>
            </button>
          </div>
        )}

        {mode === 'anthropic' && (
          <>
            <button onClick={() => setMode('menu')} className="text-xs text-neutral-500">← back</button>
            <KeyPasteForm providerId="anthropic" defaultModel="claude-opus-4-7" onConnected={onConnected} />
          </>
        )}

        {mode === 'openai' && (
          <>
            <button onClick={() => setMode('menu')} className="text-xs text-neutral-500">← back</button>
            <KeyPasteForm providerId="openai" defaultModel="gpt-4o" onConnected={onConnected} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/byok/ProviderStatus.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { readSession, clearSession, type Session } from '~/lib/ai/session';

interface Props {
  onChange: () => void;
}

export function ProviderStatus({ onChange }: Props) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(readSession());
  }, []);

  if (!session) return null;

  const label =
    session.providerId === 'anthropic' ? 'Anthropic' :
    session.providerId === 'openai'    ? 'OpenAI' :
    session.providerId === 'openrouter'? 'OpenRouter' :
                                          'Demo';

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
      <span>Connected · {label}</span>
      <button
        onClick={() => { clearSession(); setSession(null); onChange(); }}
        className="ml-2 underline underline-offset-4 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        Disconnect
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify lint + build**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/byok/
git commit -m "feat(byok): ConnectSheet + KeyPasteForm + ProviderStatus React components"
```

---

## Task 15: Chat island

**Files:**
- Create: `src/components/chat/Message.tsx`, `src/components/chat/InputBox.tsx`, `src/components/chat/CacheStat.tsx`, `src/components/chat/Chat.tsx`

- [ ] **Step 1: Write `src/components/chat/CacheStat.tsx`**

```tsx
export function CacheStat({ tokens }: { tokens: number }) {
  if (!tokens) return null;
  return (
    <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-neutral-500 border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5">
      cached · {tokens.toLocaleString()} tokens
    </span>
  );
}
```

- [ ] **Step 2: Write `src/components/chat/Message.tsx`**

```tsx
import { SafeMarkdown } from '~/lib/markdown/safe';
import { rewriteCitations } from '~/lib/ai/citations';

interface Props {
  role: 'user' | 'assistant';
  content: string;
}

export function Message({ role, content }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 px-4 py-2 text-sm">
          {content}
        </div>
      </div>
    );
  }
  const cited = rewriteCitations(content);
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-sm">
        <SafeMarkdown content={cited} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/chat/InputBox.tsx`**

```tsx
import { useState, useRef } from 'react';

interface Props {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

export function InputBox({ disabled, onSubmit }: Props) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText('');
    taRef.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="flex gap-2 items-end"
    >
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
        rows={1}
        disabled={disabled}
        placeholder="Ask about Cameron's work, AI experience, projects…"
        className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm resize-y min-h-[40px] max-h-32 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm disabled:opacity-50"
      >
        Ask
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Write `src/components/chat/Chat.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Message } from './Message';
import { InputBox } from './InputBox';
import { CacheStat } from './CacheStat';
import { ConnectSheet } from '~/components/byok/ConnectSheet';
import { ProviderStatus } from '~/components/byok/ProviderStatus';
import { getActiveProvider } from '~/lib/ai/registry';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import { readSession } from '~/lib/ai/session';
import type { ChatMessage } from '~/lib/ai/provider';
import type { CV } from '~/lib/content/cv-schema';

interface Props {
  cv: CV;
}

export function Chat({ cv }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAssistant, setPendingAssistant] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [cachedTokens, setCachedTokens] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [connectedTick, setConnectedTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Trigger re-render of ProviderStatus when session changes.
  }, [connectedTick]);

  const hasSession = readSession() !== null;
  const systemPrompt = buildSystemPrompt(cv);

  async function handleSubmit(text: string) {
    if (!hasSession) {
      setSheetOpen(true);
      return;
    }
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setPendingAssistant('');
    setBusy(true);
    setCachedTokens(0);

    const provider = getActiveProvider(systemPrompt);
    abortRef.current = new AbortController();
    let accumulated = '';
    try {
      for await (const chunk of provider.chat({ messages: next, signal: abortRef.current.signal })) {
        if (chunk.type === 'text') {
          accumulated += chunk.delta;
          setPendingAssistant(accumulated);
        } else if (chunk.type === 'cache-info') {
          setCachedTokens(chunk.cachedTokens);
        }
      }
    } catch (e) {
      accumulated += `\n\n_Error: ${e instanceof Error ? e.message : String(e)}_`;
    }
    setMessages([...next, { role: 'assistant' as const, content: accumulated }]);
    setPendingAssistant('');
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500">Chat with my CV</h2>
        {hasSession ? (
          <ProviderStatus onChange={() => setConnectedTick((t) => t + 1)} />
        ) : (
          <button
            onClick={() => setSheetOpen(true)}
            className="text-xs underline underline-offset-4 text-neutral-600 dark:text-neutral-400"
          >
            Connect to ask
          </button>
        )}
      </div>

      <div className="space-y-3 min-h-[8rem]">
        {messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}
        {pendingAssistant && <Message role="assistant" content={pendingAssistant} />}
        {messages.length === 0 && !pendingAssistant && (
          <p className="text-sm text-neutral-500 italic">
            Ask anything about Cameron's work — embedded experience, the LitePoint AI project, side projects, education.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <InputBox disabled={busy} onSubmit={handleSubmit} />
        <div className="flex items-center justify-between text-xs">
          <CacheStat tokens={cachedTokens} />
          <span className="text-neutral-500">{busy ? 'thinking…' : ''}</span>
        </div>
      </div>

      <ConnectSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConnected={() => { setSheetOpen(false); setConnectedTick((t) => t + 1); }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify lint + build**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/
git commit -m "feat(chat): Chat island — Message + InputBox + CacheStat composed"
```

---

## Task 16: Wire chat into / and create /playground

**Files:**
- Create: `src/pages/playground.astro`
- Modify: `src/pages/index.astro` (replace the stub section)

- [ ] **Step 1: Replace the chat stub in `src/pages/index.astro`**

Locate the existing block:

```astro
  <!-- Chat island placeholder; lands in Plan 2 -->
  <section class="py-8" data-island="chat-stub">
    <p class="text-sm text-neutral-500 italic">
      Chat-with-CV launches in Plan 2.
    </p>
  </section>
```

Replace with:

```astro
---
// existing frontmatter; ensure cv is loaded
import { Chat } from '~/components/chat/Chat';
---
<!-- ... rest of page above ... -->
  <section class="py-8">
    <Chat cv={cv} client:idle />
  </section>
```

`client:idle` defers hydration until the browser is idle so initial page paint isn't blocked.

- [ ] **Step 2: Create `src/pages/playground.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
import { Chat } from '~/components/chat/Chat';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
---
<Base title="Playground" description="Interactive AI features grounded in Cameron's CV">
  <h1 class="text-3xl font-semibold tracking-tight mb-2">Playground</h1>
  <p class="text-neutral-600 dark:text-neutral-400 mb-8">
    Three AI features grounded in this site's content. Connect with your own AI account (OpenRouter, Anthropic, OpenAI) or try demo mode.
    See <a href="/security" class="underline underline-offset-4">/security</a> for how keys are handled.
  </p>

  <section class="py-6 border-t border-neutral-200 dark:border-neutral-800">
    <Chat cv={cv} client:load />
  </section>

  <section class="py-6 border-t border-neutral-200 dark:border-neutral-800" id="jd-analyzer">
    <h2 class="text-sm uppercase tracking-wider text-neutral-500 mb-4">Job-description fit analyzer</h2>
    <p class="text-sm text-neutral-500 italic">Wired up in Task 18.</p>
  </section>
</Base>
```

- [ ] **Step 3: Verify build + dev server**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
test -f dist/playground/index.html && echo OK
test -f dist/index.html && grep -q 'astro-island' dist/index.html && echo "chat hydration ok"
```

Expected: `OK` and `chat hydration ok`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/playground.astro
git commit -m "feat(ai): wire Chat island into index + create /playground page"
```

---

## Task 17: JD analyzer Zod schema

**Files:**
- Create: `src/lib/ai/jd-schema.ts`, `tests/unit/jd-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/jd-schema.test.ts
import { describe, it, expect } from 'vitest';
import { JDFitSchema } from '~/lib/ai/jd-schema';

describe('JDFitSchema', () => {
  const valid = {
    fit_score: 78,
    matched_skills: [{ skill: 'Python', evidence: 'work.0.highlights.1' }],
    gaps: ['No K8s production experience'],
    tailored_intro: 'A short paragraph.',
    suggested_questions: ['What did the Regression AI Agent architecture look like?'],
  };

  it('accepts the canonical shape', () => {
    expect(() => JDFitSchema.parse(valid)).not.toThrow();
  });

  it('rejects fit_score out of [0, 100]', () => {
    expect(() => JDFitSchema.parse({ ...valid, fit_score: 101 })).toThrow();
    expect(() => JDFitSchema.parse({ ...valid, fit_score: -1 })).toThrow();
    expect(() => JDFitSchema.parse({ ...valid, fit_score: 50.5 })).toThrow();
  });

  it('requires at least one matched_skill', () => {
    expect(() => JDFitSchema.parse({ ...valid, matched_skills: [] })).toThrow();
  });

  it('allows empty gaps array', () => {
    expect(() => JDFitSchema.parse({ ...valid, gaps: [] })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/jd-schema.test.ts
```

- [ ] **Step 3: Write `src/lib/ai/jd-schema.ts`**

```ts
import { z } from 'zod';

export const JDFitSchema = z.object({
  fit_score: z.number().int().min(0).max(100),
  matched_skills: z
    .array(
      z.object({
        skill: z.string().min(1),
        evidence: z.string().min(1),
      }),
    )
    .min(1),
  gaps: z.array(z.string()),
  tailored_intro: z.string().min(1),
  suggested_questions: z.array(z.string()).min(1),
});

export type JDFit = z.infer<typeof JDFitSchema>;

export function buildJDPrompt(jobDescription: string): string {
  return `A visitor pasted this job description. Compare it against Cameron's CV (in the system prompt) and produce a structured fit assessment. \
Use citation keys (work.N.highlights.N or skills.N) for the evidence field. \
The intro paragraph should be addressable to a hiring manager and should not invent any details not present in the CV.

Job description:
"""
${jobDescription}
"""

Respond with ONLY a JSON object matching this shape:
{
  "fit_score": integer 0-100,
  "matched_skills": [{"skill": "...", "evidence": "work.0.highlights.1"}, ...],
  "gaps": ["..."],
  "tailored_intro": "...",
  "suggested_questions": ["..."]
}`;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test tests/unit/jd-schema.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/jd-schema.ts tests/unit/jd-schema.test.ts
git commit -m "feat(ai): JD-analyzer Zod schema + prompt builder"
```

---

## Task 18: JD analyzer island

**Files:**
- Create: `src/components/jd-analyzer/ScoreGauge.tsx`, `src/components/jd-analyzer/ResultCard.tsx`, `src/components/jd-analyzer/JDAnalyzer.tsx`
- Modify: `src/pages/playground.astro` (replace JD-analyzer stub)

- [ ] **Step 1: Write `src/components/jd-analyzer/ScoreGauge.tsx`**

```tsx
interface Props {
  score: number;
}

export function ScoreGauge({ score }: Props) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="relative w-24 h-24" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={radius} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth="6" fill="none" />
        <circle
          cx="40" cy="40" r={radius}
          className={`${color} transition-[stroke-dashoffset] duration-500`}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{score}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/jd-analyzer/ResultCard.tsx`**

```tsx
import type { JDFit } from '~/lib/ai/jd-schema';
import { ScoreGauge } from './ScoreGauge';
import { rewriteCitations } from '~/lib/ai/citations';
import { SafeMarkdown } from '~/lib/markdown/safe';

export function ResultCard({ fit }: { fit: JDFit }) {
  return (
    <div className="space-y-6 border border-neutral-200 dark:border-neutral-800 rounded p-6">
      <header className="flex items-center gap-6">
        <ScoreGauge score={fit.fit_score} />
        <div>
          <h3 className="font-medium">Fit score</h3>
          <p className="text-sm text-neutral-500">Higher means closer alignment with the JD.</p>
        </div>
      </header>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Matched skills</h4>
        <ul className="space-y-1">
          {fit.matched_skills.map((m, i) => (
            <li key={i} className="text-sm">
              <strong>{m.skill}</strong>{' '}
              <span className="text-neutral-500">— {rewriteCitations(`[${m.evidence}]`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {fit.gaps.length > 0 && (
        <section>
          <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Gaps</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">{fit.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </section>
      )}

      <section>
        <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Tailored intro</h4>
        <SafeMarkdown content={rewriteCitations(fit.tailored_intro)} />
        <button
          onClick={() => navigator.clipboard.writeText(fit.tailored_intro)}
          className="mt-2 text-xs underline underline-offset-4"
        >
          Copy
        </button>
      </section>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Suggested interview questions</h4>
        <ol className="list-decimal pl-5 space-y-1 text-sm">{fit.suggested_questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/jd-analyzer/JDAnalyzer.tsx`**

```tsx
import { useState } from 'react';
import { ResultCard } from './ResultCard';
import { ConnectSheet } from '~/components/byok/ConnectSheet';
import { getActiveProvider } from '~/lib/ai/registry';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import { readSession } from '~/lib/ai/session';
import { JDFitSchema, type JDFit, buildJDPrompt } from '~/lib/ai/jd-schema';
import type { CV } from '~/lib/content/cv-schema';

export function JDAnalyzer({ cv }: { cv: CV }) {
  const [jd, setJd] = useState('');
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState<JDFit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const systemPrompt = buildSystemPrompt(cv);

  async function analyze() {
    if (!jd.trim()) return;
    if (!readSession()) { setSheetOpen(true); return; }
    setBusy(true);
    setErr(null);
    setFit(null);
    try {
      const provider = getActiveProvider(systemPrompt);
      const result = await provider.structured({ prompt: buildJDPrompt(jd), schema: JDFitSchema });
      setFit(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="Paste a job description here…"
        rows={6}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm resize-y"
      />
      <button
        onClick={analyze}
        disabled={busy || !jd.trim()}
        className="px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm disabled:opacity-50"
      >
        {busy ? 'Analyzing…' : 'Analyze fit'}
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {fit && <ResultCard fit={fit} />}
      <ConnectSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onConnected={() => { setSheetOpen(false); analyze(); }} />
    </div>
  );
}
```

- [ ] **Step 4: Wire into `src/pages/playground.astro` — replace the stub section:**

Replace:
```astro
  <section class="py-6 border-t border-neutral-200 dark:border-neutral-800" id="jd-analyzer">
    <h2 class="text-sm uppercase tracking-wider text-neutral-500 mb-4">Job-description fit analyzer</h2>
    <p class="text-sm text-neutral-500 italic">Wired up in Task 18.</p>
  </section>
```

With:
```astro
---
import { JDAnalyzer } from '~/components/jd-analyzer/JDAnalyzer';
---
<!-- ... -->
  <section class="py-6 border-t border-neutral-200 dark:border-neutral-800" id="jd-analyzer">
    <h2 class="text-sm uppercase tracking-wider text-neutral-500 mb-4">Job-description fit analyzer</h2>
    <p class="text-sm text-neutral-500 mb-4">Paste a JD; the AI returns a fit score, matched skills, gaps, and a tailored intro. Uses your connected provider.</p>
    <JDAnalyzer cv={cv} client:visible />
  </section>
```

- [ ] **Step 5: Verify build**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run build
test -f dist/playground/index.html && echo OK
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add src/components/jd-analyzer/ src/pages/playground.astro
git commit -m "feat(ai): JD analyzer island — scorecard + structured output"
```

---

## Task 19: Update /security page wording

**Files:**
- Modify: `src/pages/security.astro`

Plan 1's `/security` page says "AI features (Plan 2)" in the section heading. Now that AI features are live, replace that language.

- [ ] **Step 1: Replace the Plan-2-reference heading and intro**

Find:
```astro
    <h2>How AI features work (Plan 2)</h2>
    <p>
      When you connect an AI account (OpenRouter OAuth, or paste a direct provider key),
```

Replace with:
```astro
    <h2>How AI features work</h2>
    <p>
      When you connect an AI account (OpenRouter via OAuth, or paste a direct Anthropic/OpenAI key),
```

And find any other references like "(Plan 2)" or "(Plan 3)" — leave the Plan 3 reference if present, since the activity visualizer is still future.

- [ ] **Step 2: Verify build**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/security.astro
git commit -m "docs(security): drop 'Plan 2' qualifier — AI features are live"
```

---

## Task 20: Playwright happy-path E2E for chat (demo mode)

**Files:**
- Create: `tests/e2e/chat-demo.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/chat-demo.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat in demo mode', () => {
  test('connect → ask → stream → cite', async ({ page }) => {
    await page.goto('/playground');

    // The Connect to ask button is visible because no session exists yet.
    await page.getByRole('button', { name: /Connect to ask/i }).click();

    // Pick demo mode.
    await page.getByRole('button', { name: /Try demo mode/i }).click();

    // After connect, the connect button is replaced by ProviderStatus.
    await expect(page.getByText(/Connected · Demo/i)).toBeVisible();

    // Type a question that matches the embedded keyword.
    const ta = page.getByPlaceholder(/Ask about Cameron/i);
    await ta.fill('Tell me about Cameron embedded experience');
    await page.getByRole('button', { name: /^Ask$/ }).click();

    // The assistant streams a response containing one of the embedded keywords.
    const assistantBubble = page.locator('.prose-sm').last();
    await expect(assistantBubble).toContainText(/firmware|embedded|LitePoint/i, { timeout: 8000 });

    // The response contains a citation anchor.
    await expect(page.locator('a[href^="/cv/#work-0-highlights-"]').first()).toBeVisible();
  });

  test('disconnect clears the session', async ({ page }) => {
    await page.goto('/playground');
    await page.getByRole('button', { name: /Connect to ask/i }).click();
    await page.getByRole('button', { name: /Try demo mode/i }).click();
    await expect(page.getByText(/Connected · Demo/i)).toBeVisible();

    await page.getByRole('button', { name: /^Disconnect$/ }).click();
    await expect(page.getByText(/Connected · Demo/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Connect to ask/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test:e2e tests/e2e/chat-demo.spec.ts
```

Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/chat-demo.spec.ts
git commit -m "test(e2e): chat in demo mode — connect, ask, stream, cite, disconnect"
```

---

## Task 21: Playwright happy-path E2E for JD analyzer (demo mode)

**Files:**
- Create: `tests/e2e/jd-analyzer-demo.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test.describe('JD analyzer in demo mode', () => {
  test('paste JD → see scorecard', async ({ page }) => {
    await page.goto('/playground#jd-analyzer');

    // The textarea lives inside the JDAnalyzer island.
    const ta = page.getByPlaceholder(/Paste a job description/i);
    await ta.fill('Senior software engineer, embedded + Python + Docker. Background in test automation a plus.');

    await page.getByRole('button', { name: /Analyze fit/i }).click();

    // Connect sheet appears (no session yet); pick demo.
    await page.getByRole('button', { name: /Try demo mode/i }).click();

    // Demo returns a deterministic shape — fit_score 72.
    await expect(page.getByText(/Fit score/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('72')).toBeVisible();

    // Matched-skills list rendered.
    await expect(page.getByText(/Matched skills/i)).toBeVisible();
    await expect(page.getByText(/Python/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test:e2e tests/e2e/jd-analyzer-demo.spec.ts
```

Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/jd-analyzer-demo.spec.ts
git commit -m "test(e2e): JD analyzer in demo mode — paste JD, see scorecard"
```

---

## Task 22: BYOK CSP regression test reinforcement

**Files:**
- Modify: `tests/integration/csp-meta.test.ts`

Plan 1 set the CSP allowlist. With AI features now wired up, add a positive test that the meta tag is actually emitted on a built page (not just present in source) — guards against a build-time stripping regression.

- [ ] **Step 1: Add to `tests/integration/csp-meta.test.ts`**

Append after the existing `describe` block:

```ts
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('CSP in built HTML', () => {
  it('emits Content-Security-Policy meta on /cv', async () => {
    const file = await readFile(resolve(__dirname, '../../dist/cv/index.html'), 'utf8');
    expect(file).toMatch(/http-equiv="Content-Security-Policy"/);
    expect(file).toContain('https://api.anthropic.com');
    expect(file).toContain('https://openrouter.ai');
  });

  it('emits Content-Security-Policy meta on /playground', async () => {
    const file = await readFile(resolve(__dirname, '../../dist/playground/index.html'), 'utf8');
    expect(file).toMatch(/http-equiv="Content-Security-Policy"/);
  });
});
```

> Note: this test reads from `dist/` so a `bun run build` must have run first. CI does build → test in order; locally, run `bun run build` once before the test suite if `dist/` is stale.

- [ ] **Step 2: Build then test**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$HOME/.bun/bin:$PATH" bun run test
```

Expected: all unit + integration tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/csp-meta.test.ts
git commit -m "test: pin CSP meta is emitted in built /cv and /playground HTML"
```

---

## Task 23: Final integration check + tag

**Files:** none (gating checks only)

- [ ] **Step 1: Full test suite green**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run test       # unit + integration
PATH="$HOME/.bun/bin:$PATH" bun run build
PATH="$HOME/.bun/bin:$PATH" bun run test:e2e   # all e2e specs
```

Expected: every command exits 0. Unit/integration tests should be ≥ 50 (17 from Plan 1 + ~33 new from Plan 2 tasks); E2E should be 7 (5 from Plan 1 + 2 new — chat + JD).

- [ ] **Step 2: Manual smoke test in dev**

```bash
PATH="$HOME/.bun/bin:$PATH" bun run dev &
sleep 4
xdg-open http://localhost:4321/playground 2>/dev/null || open http://localhost:4321/playground 2>/dev/null || echo "Visit http://localhost:4321/playground manually"
```

Verify:
- Chat in demo mode works end-to-end.
- JD analyzer in demo mode returns the canned fit shape.
- Disconnect button clears the session.
- ConnectSheet opens, all four options visible.
- OpenRouter OAuth button redirects to `https://openrouter.ai/auth` (don't complete the flow with a real account during smoke testing).

Kill the dev server when done.

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "Plan 2: AI features (Chat-with-CV, JD analyzer, BYOK)" --body "$(cat <<'EOF'
## Summary
- Provider abstraction (OpenRouter, Anthropic, OpenAI, Demo) with shared streaming interface
- Chat-with-CV island, hydrated on / (idle) and /playground (load)
- JD analyzer with structured output via Zod
- BYOK ConnectSheet + sessionStorage-only credential handling
- OAuth/PKCE callback at /oauth/callback with code-scrub
- Safe-markdown renderer (marked + DOMPurify) for assistant output
- Citation parser turning [work.0.highlights.1] into anchors to /cv

## Test plan
- [ ] CI green (unit + integration + e2e)
- [ ] After deploy, /playground loads
- [ ] Chat in demo mode streams an embedded-keyword response with at least one /cv anchor
- [ ] JD analyzer in demo mode returns the canned fit_score=72 shape
- [ ] Visiting / shows the chat island with a "Connect to ask" prompt

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After PR merges, tag**

```bash
git checkout main
git pull --ff-only origin main
git tag -a v2.0-ai-features -m "Plan 2 (AI features — BYOK chat, JD analyzer) shipped"
git push origin v2.0-ai-features
```

---

## Self-review (plan author's checklist)

- ✅ **Spec §7.1 (provider abstraction)** → Task 2 + Tasks 7, 8, 9, 11
- ✅ **Spec §7.2 (connection UX, sessionStorage only)** → Tasks 3, 14
- ✅ **Spec §7.3 (chat with prompt caching + citations)** → Tasks 4, 5, 6, 8 (cache), 15
- ✅ **Spec §7.4 (JD analyzer with Zod schema)** → Tasks 17, 18
- ✅ **Spec §7.5 (activity visualizer)** → Plan 3 (NOT in this plan, intentional)
- ✅ **Spec §8.2 (BYOK security — CSP allowlist, DOMPurify, PKCE, sessionStorage)** → Tasks 6, 10, 12, 22
- ✅ **Out of scope per spec §7.6**: no vector DB, no server-side AI proxy, no cross-session memory — none added.
- ✅ **No placeholders** in task steps. Every code block is complete.
- ✅ **Type consistency**: `AIProvider`/`ChatChunk`/`ChatMessage`/`StructuredOpts` defined in Task 2, used identically in 7/8/9/11/13/15/18. `Session` shape in Task 3 used by 13/14. `JDFit`/`JDFitSchema` in Task 17 used by 18.
- ✅ **CSP allowlist**: Plan 1's `connect-src` already includes every host this plan touches (anthropic, openai, openrouter, google generative, github). No CSP changes needed — and Task 22 strengthens the pin.

Open polish items deferred from Plan 1 (mentioned in its code review) — not blocking, not in scope for Plan 2:
- Centralize the `https://cameronhartman.dev` host string in `src/pages/llms.txt.ts`.
- Add `is:inline` to `src/components/JsonLd.astro` to silence the Astro hint.

Add a small follow-up PR if you want these.
