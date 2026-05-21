# Remove Demo Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the demo AI provider from `/playground` end-to-end (provider class, type-union entry, dispatch, UI surfaces, copy, tests) while keeping the T&C gate and the three real providers (OpenRouter, Anthropic, OpenAI) unchanged.

**Architecture:** Bottom-up sequence. First add the silent-migration safety net in `readSession()` so returning visitors with a stale `{providerId: 'demo'}` in sessionStorage degrade gracefully to "not connected." Then strip demo UI affordances (button, label, amber notice, copy strings). Then atomically remove the backend (registry dispatch, type union narrowing, `demo.ts` deletion, demo-only test deletions). Finally update auto-memory and verify with build + tests.

**Tech Stack:** Astro 6.3.5 + React 19 islands + TypeScript 5 strict + Bun. Vitest (unit) + Playwright (E2E).

**Spec:** [`docs/superpowers/specs/2026-05-21-remove-demo-provider-design.md`](../specs/2026-05-21-remove-demo-provider-design.md)

---

## Prerequisites

- Working directory: `/home/dexter/Projects/CV`
- Branch: `remove-demo-provider` (already exists; spec doc is at HEAD)
- Working tree clean
- Bun installed at `~/.bun/bin/bun`
- Playwright chromium installed (from `bunx playwright install chromium`)

Confirm before starting:

```bash
cd /home/dexter/Projects/CV
git status                       # expect: clean, on remove-demo-provider
git log --oneline -3             # expect: top commit is the spec doc (7d1c2e5)
git fetch origin main && git log --oneline origin/main..HEAD  # see what's ahead of main
```

If main has moved meaningfully since the branch was cut, merge it in:

```bash
git merge origin/main --no-edit
```

---

## Task 1: Add silent migration to readSession()

**Files:**
- Modify: `src/lib/ai/session.ts` (adds `VALID_PROVIDER_IDS` constant + 1-line guard in `readSession`)
- Test: `tests/unit/ai-session.test.ts` (adds 1 new test)

This is purely additive. Demo dispatch still works after this task because `'demo'` remains in `ProviderId` (until Task 3) and is still listed in `VALID_PROVIDER_IDS` for now. The new test seeds an unknown provider id (`'xyz'`) to exercise the validation path without depending on demo's status.

- [ ] **Step 1.1: Write the failing test**

Append to `tests/unit/ai-session.test.ts` inside the `describe('BYOK session storage', ...)` block, before the closing `});`:

```ts
  it('returns null when sessionStorage holds an unknown providerId', () => {
    // Simulates a stale session payload from a removed provider — e.g. a returning
    // visitor whose browser still has data from before a provider was retired.
    sessionStorage.setItem(
      'byok-session',
      JSON.stringify({ providerId: 'xyz', token: 'irrelevant', model: 'irrelevant' }),
    );
    expect(readSession()).toBeNull();
  });
```

- [ ] **Step 1.2: Run the new test to verify it fails**

```bash
~/.bun/bin/bun run test tests/unit/ai-session.test.ts -t "unknown providerId" 2>&1 | tail -15
```

Expected: FAIL — `readSession()` returns the parsed object instead of null, so `expect(...).toBeNull()` fails.

- [ ] **Step 1.3: Implement the validation in `readSession`**

Edit `src/lib/ai/session.ts`. After the existing `import type { ProviderId } from './provider';` line, add:

```ts
const VALID_PROVIDER_IDS: readonly ProviderId[] = ['openrouter', 'anthropic', 'openai', 'demo'];
```

(`'demo'` stays in this list for now — it'll be removed in Task 3 along with the union narrowing. Keeping it here through Task 2 means demo still dispatches normally and no existing tests break prematurely.)

Then inside `readSession()`, add the validation as a new line between the existing field check and the `return parsed;`:

```ts
    if (!parsed.providerId || typeof parsed.token !== 'string' || !parsed.model) return null;
    if (!VALID_PROVIDER_IDS.includes(parsed.providerId)) return null;
    return parsed;
```

- [ ] **Step 1.4: Run the test to verify it passes**

```bash
~/.bun/bin/bun run test tests/unit/ai-session.test.ts 2>&1 | tail -10
```

Expected: PASS — all session tests green, including the new "unknown providerId" case.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/ai/session.ts tests/unit/ai-session.test.ts
git commit -m "$(cat <<'EOF'
feat(session): silently reject sessions with unknown providerId

Adds VALID_PROVIDER_IDS allowlist + 1-line guard in readSession() so a
stale session payload referencing a provider no longer in the union
returns null instead of dispatching through the switch. This is the
migration path for returning visitors with old demo sessions once demo
is removed in a follow-up commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Remove UI demo references

**Files:**
- Modify: `src/components/byok/ConnectSheet.tsx` (delete `startDemo` + demo button)
- Modify: `src/components/byok/ProviderStatus.tsx` (drop `'Demo'` fallback in label ternary)
- Modify: `src/components/jd-analyzer/JDAnalyzer.tsx` (delete amber demo-mode notice block)
- Modify: `src/components/byok/TermsGate.tsx` (strip `, or local demo mode` from T&C copy)
- Modify: `src/pages/playground.astro` (strip `or try demo mode` from intro copy)
- Modify: `src/pages/security.astro` (reword the "use demo mode instead" sentence)

After this task, the UI exposes only the three real providers, but the demo provider class still exists and is still dispatchable if something writes `{providerId: 'demo'}` directly to sessionStorage (E2E tests do this). The build stays green.

- [ ] **Step 2.1: Remove `startDemo` and the demo button from ConnectSheet**

Edit `src/components/byok/ConnectSheet.tsx`. Delete this block (it's the `startDemo` function around lines 45-48):

```ts
  function startDemo() {
    writeSession({ providerId: 'demo', token: '', model: 'demo' });
    onConnected();
  }
```

Also delete the demo button JSX (around lines 95-103):

```tsx
            <button
              onClick={startDemo}
              className="w-full text-left px-4 py-3 rounded border border-dashed border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Try demo mode</div>
              <div className="text-xs text-neutral-500">
                No key, no calls — pre-baked answers about Cameron.
              </div>
            </button>
```

The `writeSession` import on line 3 may become unused — check by grepping the file for `writeSession`. If unused, remove the import. (Other current usages: there are none in this file once `startDemo` is gone, so the import will be unused.)

- [ ] **Step 2.2: Drop `'Demo'` from the ProviderStatus label**

Edit `src/components/byok/ProviderStatus.tsx`. Replace the existing label ternary (around lines 17-24):

```ts
  const label =
    session.providerId === 'anthropic'
      ? 'Anthropic'
      : session.providerId === 'openai'
        ? 'OpenAI'
        : session.providerId === 'openrouter'
          ? 'OpenRouter'
          : 'Demo';
```

with:

```ts
  const label =
    session.providerId === 'anthropic'
      ? 'Anthropic'
      : session.providerId === 'openai'
        ? 'OpenAI'
        : 'OpenRouter';
```

After Task 3 narrows the union, TypeScript will confirm this ternary is exhaustive.

- [ ] **Step 2.3: Remove the amber demo-mode notice from JDAnalyzer**

Edit `src/components/jd-analyzer/JDAnalyzer.tsx`. Replace the current result-render block (around lines 121-132):

```tsx
      {fit && (
        <>
          {readSession()?.providerId === 'demo' && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Demo mode:</strong> this is a sample analysis. The demo provider returns the
              same response regardless of the pasted job description. Connect a real provider
              (OpenRouter, Anthropic, OpenAI) for an analysis that actually reads your JD.
            </p>
          )}
          <ResultCard fit={fit} />
        </>
      )}
```

with the simpler:

```tsx
      {fit && <ResultCard fit={fit} />}
```

The `readSession` import is still used elsewhere in the file (line 38 guard), so leave the import alone.

- [ ] **Step 2.4: Update TermsGate copy**

Edit `src/components/byok/TermsGate.tsx`. The T&C point 2 currently reads (around line 50-51):

```tsx
              <strong>You bring the key.</strong> Inference is performed by your connected provider
              (OpenRouter, Anthropic, OpenAI, or local demo mode). This site does not proxy, log, or
```

Change to:

```tsx
              <strong>You bring the key.</strong> Inference is performed by your connected provider
              (OpenRouter, Anthropic, OpenAI). This site does not proxy, log, or
```

- [ ] **Step 2.5: Update playground page intro copy**

Edit `src/pages/playground.astro`. Around line 17-21:

```astro
    Interactive AI features grounded in this site&rsquo;s content. Connect with your own AI account
    (OpenRouter, Anthropic, OpenAI) or try demo mode. See <a
      href="/security"
      class="underline underline-offset-4">/security</a
    > for how keys are handled.
```

Change to:

```astro
    Interactive AI features grounded in this site&rsquo;s content. Connect with your own AI account
    (OpenRouter, Anthropic, OpenAI). See <a
      href="/security"
      class="underline underline-offset-4">/security</a
    > for how keys are handled.
```

- [ ] **Step 2.6: Reword security.astro line 30**

Edit `src/pages/security.astro`. Around lines 28-31, the current paragraph reads:

```astro
    <p>
      Browser extensions and compromised tabs can read <code>sessionStorage</code>. If you don't
      trust the browser session you're in, use demo mode instead.
    </p>
```

Change to:

```astro
    <p>
      Browser extensions and compromised tabs can read <code>sessionStorage</code>. If you don't
      trust the browser session you're in, don't paste a key — leave the playground until you're
      on a session you trust.
    </p>
```

- [ ] **Step 2.7: Build to confirm everything still compiles**

```bash
~/.bun/bin/bun run build 2>&1 | tail -5
```

Expected: build succeeds, page count reads `[build] 9 page(s) built in …`. No TypeScript errors.

- [ ] **Step 2.8: Run unit tests to confirm nothing broke**

```bash
~/.bun/bin/bun run test 2>&1 | tail -10
```

Expected: all unit + integration tests pass. (Demo provider tests still pass because demo.ts still exists and the dispatch path is unchanged.)

- [ ] **Step 2.9: Commit**

```bash
git add src/components/byok/ConnectSheet.tsx src/components/byok/ProviderStatus.tsx \
        src/components/jd-analyzer/JDAnalyzer.tsx src/components/byok/TermsGate.tsx \
        src/pages/playground.astro src/pages/security.astro
git commit -m "$(cat <<'EOF'
ui: remove demo provider affordances from /playground + /security

Strips the "Try demo mode" button from ConnectSheet, the 'Demo' label
fallback from ProviderStatus, the amber "Demo mode: this is a sample
analysis" notice from JDAnalyzer (the PR #50 UX guard), the demo
mention in the T&C copy, the demo mention in the playground page
intro, and the demo escape-hatch suggestion in /security.

The demo provider class and dispatch are still intact at this point;
the backend removal lands in a follow-up commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Atomic backend removal — narrow union, harden registry, delete demo.ts and demo-only tests

**Files:**
- Modify: `src/lib/ai/provider.ts` (narrow `ProviderId` union)
- Modify: `src/lib/ai/registry.ts` (remove demo import + fallback + case; add throw on no-session)
- Modify: `src/lib/ai/session.ts` (drop `'demo'` from `VALID_PROVIDER_IDS`)
- Modify: `tests/unit/ai-registry.test.ts` (replace "returns DemoProvider when no session" + drop demo case test; add "throws when no session" + "throws on unknown providerId" tests)
- Modify: `tests/unit/ai-session.test.ts` (fix the demo `writeSession` line; existing migration test now exercises the actual demo case path naturally)
- Modify: `tests/e2e/playground-security.spec.ts` (line 34: switch demo session to fake openrouter session)
- Delete: `src/lib/ai/demo.ts`
- Delete: `tests/unit/ai-demo-provider.test.ts`
- Delete: `tests/e2e/chat-demo.spec.ts`
- Delete: `tests/e2e/jd-analyzer-demo.spec.ts`

These changes are tightly coupled: narrowing the union without removing the dispatch case is a TS error, removing the case without deleting `demo.ts` leaves a dangling import, deleting `demo.ts` without removing the unit-test file leaves a broken import, etc. Do them in one task. Test changes go in the same commit so CI doesn't fail between commits.

- [ ] **Step 3.1: Narrow the `ProviderId` union**

Edit `src/lib/ai/provider.ts` line 1:

```ts
export type ProviderId = 'openrouter' | 'anthropic' | 'openai' | 'demo';
```

Change to:

```ts
export type ProviderId = 'openrouter' | 'anthropic' | 'openai';
```

- [ ] **Step 3.2: Update `registry.ts` to throw + drop demo dispatch**

Edit `src/lib/ai/registry.ts`. Replace the entire file contents:

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
    case 'anthropic':
      return new AnthropicProvider(s.token, systemPrompt);
    case 'openai':
      return new OpenAIProvider(s.token, systemPrompt);
    case 'openrouter':
      return new OpenRouterProvider(s.token, systemPrompt);
    case 'demo':
      return new DemoProvider();
  }
}
```

with:

```ts
import type { AIProvider } from './provider';
import { readSession } from './session';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';

export function getActiveProvider(systemPrompt: string): AIProvider {
  const s = readSession();
  if (!s) throw new Error('No active provider session — connect a provider first.');
  switch (s.providerId) {
    case 'anthropic':
      return new AnthropicProvider(s.token, systemPrompt);
    case 'openai':
      return new OpenAIProvider(s.token, systemPrompt);
    case 'openrouter':
      return new OpenRouterProvider(s.token, systemPrompt);
  }
}
```

Both existing callers (`src/components/chat/Chat.tsx:51`, `src/components/jd-analyzer/JDAnalyzer.tsx:38`) already guard with `readSession()` before invoking `getActiveProvider`, so the throw is unreachable in normal flow — it's a contract assertion. The narrowed union turns the switch into a TS exhaustiveness check; the compiler will reject any future provider addition that forgets a case.

- [ ] **Step 3.3: Drop `'demo'` from `VALID_PROVIDER_IDS` in session.ts**

Edit `src/lib/ai/session.ts`. The line added in Task 1 currently reads:

```ts
const VALID_PROVIDER_IDS: readonly ProviderId[] = ['openrouter', 'anthropic', 'openai', 'demo'];
```

Change to:

```ts
const VALID_PROVIDER_IDS: readonly ProviderId[] = ['openrouter', 'anthropic', 'openai'];
```

(With `'demo'` removed from both the union and this allowlist, any returning visitor's stale demo session is silently rejected by `readSession()` and they see the "Connect to ask" prompt as if they had never connected.)

- [ ] **Step 3.4: Delete demo.ts and the three demo-only test files**

```bash
rm src/lib/ai/demo.ts \
   tests/unit/ai-demo-provider.test.ts \
   tests/e2e/chat-demo.spec.ts \
   tests/e2e/jd-analyzer-demo.spec.ts
```

- [ ] **Step 3.5: Update ai-registry.test.ts to match the new contract**

Replace the entire contents of `tests/unit/ai-registry.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveProvider } from '~/lib/ai/registry';
import { writeSession, clearSession } from '~/lib/ai/session';
import { AnthropicProvider } from '~/lib/ai/anthropic';
import { OpenAIProvider } from '~/lib/ai/openai';
import { OpenRouterProvider } from '~/lib/ai/openrouter';

describe('getActiveProvider', () => {
  beforeEach(() => {
    clearSession();
    sessionStorage.clear();
  });

  it('throws when no session is set', () => {
    expect(() => getActiveProvider('')).toThrow(/No active provider session/);
  });

  it('throws when sessionStorage holds an unknown providerId', () => {
    // Simulates a stale session — readSession() silently rejects it, so
    // getActiveProvider sees no session and throws via the no-session path.
    sessionStorage.setItem(
      'byok-session',
      JSON.stringify({ providerId: 'xyz', token: 'x', model: 'y' }),
    );
    expect(() => getActiveProvider('')).toThrow(/No active provider session/);
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
    writeSession({
      providerId: 'openrouter',
      token: 'sk-or-x',
      model: 'anthropic/claude-opus-4-7',
    });
    expect(getActiveProvider('sys')).toBeInstanceOf(OpenRouterProvider);
  });
});
```

- [ ] **Step 3.6: Fix the demo writeSession line in ai-session.test.ts**

Edit `tests/unit/ai-session.test.ts`. The test `it('clear removes the session', ...)` writes a demo session that's no longer valid (would now fail union validation). Replace:

```ts
  it('clear removes the session', () => {
    writeSession({ providerId: 'demo', token: '', model: 'demo' });
    clearSession();
    expect(readSession()).toBeNull();
  });
```

with:

```ts
  it('clear removes the session', () => {
    writeSession({ providerId: 'anthropic', token: 'sk-ant-x', model: 'claude-opus-4-7' });
    clearSession();
    expect(readSession()).toBeNull();
  });
```

The previously-added `it('returns null when sessionStorage holds an unknown providerId', ...)` test from Task 1 stays as-is — it uses the synthetic `'xyz'` id, not `'demo'`, so it's unaffected by the union narrowing.

- [ ] **Step 3.7: Update the playground-security E2E to use a fake openrouter session**

Edit `tests/e2e/playground-security.spec.ts` around line 30-37. The current block:

```ts
      sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
      sessionStorage.setItem('cv.chat.count', '50');
      sessionStorage.setItem(
        'byok-session',
        JSON.stringify({ providerId: 'demo', token: 'x', model: 'demo-default' }),
      );
```

Change `byok-session` to a valid openrouter shape:

```ts
      sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
      sessionStorage.setItem('cv.chat.count', '50');
      sessionStorage.setItem(
        'byok-session',
        JSON.stringify({
          providerId: 'openrouter',
          token: 'fake-test-token',
          model: 'google/gemini-2.0-flash-exp:free',
        }),
      );
```

The test exercises the rate-cap guard, which fires before any actual provider call. The fake token is never used to make a request. Confirm by reading the test — it should send a message and assert the cap-reached UI appears, never awaiting a real network response.

- [ ] **Step 3.8: Run build + full unit suite**

```bash
~/.bun/bin/bun run build 2>&1 | tail -5
```

Expected: build succeeds, no TS errors.

```bash
~/.bun/bin/bun run test 2>&1 | tail -10
```

Expected: all tests pass. Number of unit/integration tests will be lower than before (the 6 demo-provider tests are gone, 2 new registry tests added).

- [ ] **Step 3.9: Verify no orphan demo references remain in src/ or tests/**

```bash
grep -rn -i "demo\b\|Demo\b" src/ tests/ --include="*.ts" --include="*.tsx" --include="*.astro" 2>&1 | grep -v "// demo" | grep -v "_debug"
```

Expected: zero matches (or only matches inside the auto-memory which is outside the repo, or comments that mention demo historically without using it as a symbol — review any output and confirm there's no live code reference).

- [ ] **Step 3.10: Commit**

```bash
git add src/lib/ai/provider.ts src/lib/ai/registry.ts src/lib/ai/session.ts \
        tests/unit/ai-registry.test.ts tests/unit/ai-session.test.ts \
        tests/e2e/playground-security.spec.ts
git rm src/lib/ai/demo.ts tests/unit/ai-demo-provider.test.ts \
       tests/e2e/chat-demo.spec.ts tests/e2e/jd-analyzer-demo.spec.ts
git commit -m "$(cat <<'EOF'
refactor(ai): remove demo provider backend + tests

Narrows ProviderId union to just the three real providers, hardens
getActiveProvider() to throw when no session or unknown id (the
narrowed switch becomes a TS exhaustiveness check), drops 'demo' from
session.ts's VALID_PROVIDER_IDS so stale demo sessions silently
migrate to "not connected", deletes src/lib/ai/demo.ts entirely.

Tests: removes ai-demo-provider.test.ts (6 tests), chat-demo.spec.ts,
jd-analyzer-demo.spec.ts. Updates ai-registry.test.ts to assert the
new throw contract. Fixes ai-session.test.ts and
playground-security.spec.ts where they incidentally wrote demo
sessions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update auto-memory

**Files:**
- Modify: `/home/dexter/.claude/projects/-home-dexter/memory/project_cv.md`

The memory file is outside the repo. No commit step — filesystem persistence carries it forward to future sessions.

- [ ] **Step 4.1: Update the BYOK paragraph**

Find this line in `project_cv.md`:

```
- Bring-Your-Own-Key model: visitors connect their own AI account (OpenRouter OAuth, Anthropic key paste, OpenAI key paste, or local demo mode). All inference happens browser → provider directly; Cameron pays nothing.
```

Change to:

```
- Bring-Your-Own-Key model: visitors connect their own AI account (OpenRouter OAuth, Anthropic key paste, OpenAI key paste). All inference happens browser → provider directly; Cameron pays nothing.
```

- [ ] **Step 4.2: Delete the demo provider description line**

Find and delete this line entirely:

```
- Demo provider in `src/lib/ai/demo.ts` has hand-written canned answers keyed by regex; kept in sync with the cv.yaml summary + bullets when those change.
```

- [ ] **Step 4.3: Rewrite the PR #50 follow-up clause**

In the "Plan 6 follow-up patches" paragraph, find the PR #50 sentence:

```
PR #50 `31e9f0d` ships an inline amber "Demo mode: this is a sample analysis" notice above the JDAnalyzer ResultCard when the active session is the demo provider — DemoProvider.structured() in `src/lib/ai/demo.ts` intentionally returns a hardcoded `JDFit` placeholder regardless of input (this is by design, **not a bug** — the comment at `demo.ts:61` owns this; the notice is the UX guard, don't "fix" the demo to actually analyze).
```

Replace with:

```
PR #50 (2026-05-12) originally shipped an inline amber "Demo mode" notice above the JDAnalyzer ResultCard for demo sessions, because DemoProvider.structured() returned a hardcoded `JDFit` placeholder regardless of input. The demo provider and that notice were both removed on 2026-05-21; `src/lib/ai/demo.ts`, the amber notice, and the `ai-demo-provider` / `chat-demo` / `jd-analyzer-demo` test files are gone. Don't reference `demo.ts` or `providerId === 'demo'` in new code.
```

- [ ] **Step 4.4: Leave the astro 6 debugging section alone**

The `chat-demo` mention in the astro 6 debugging paragraph (around line 14, in the list of E2E tests that failed during the hydration investigation) is historical evidence — leave it as-is.

- [ ] **Step 4.5: Quick verification grep**

```bash
grep -i "demo\b" /home/dexter/.claude/projects/-home-dexter/memory/project_cv.md
```

Expected: zero forward-looking demo references. The only matches should be inside the historical astro 6 debugging section's `chat-demo` filename reference.

---

## Task 5: Final verification, push, and PR

**Files:** None modified

- [ ] **Step 5.1: Final source/test demo grep**

```bash
grep -rn -i "\bdemo\b\|DemoProvider" src/ tests/ --include="*.ts" --include="*.tsx" --include="*.astro" 2>&1
```

Expected: zero matches. If anything appears, evaluate whether it's a live code reference or an incidental string (e.g. a doc comment referencing past behavior). Live references must be removed.

- [ ] **Step 5.2: Sweep TODO.md for demo references**

```bash
grep -n -i "demo" TODO.md
```

Expected: zero matches. If any appear (e.g., nightly refresh added something), evaluate + update inline.

- [ ] **Step 5.3: Build + unit tests one last time**

```bash
~/.bun/bin/bun run build 2>&1 | tail -5
~/.bun/bin/bun run test 2>&1 | tail -10
```

Expected: build clean; all tests pass.

- [ ] **Step 5.4: Run the full Playwright suite locally**

```bash
PATH="$HOME/.bun/bin:$PATH" timeout 300 ~/.bun/bin/bunx playwright test --reporter=line --workers=2 2>&1 | tail -15
```

Expected: all tests pass. The total test count should be lower than before because two demo E2E specs are gone.

- [ ] **Step 5.5: Push the branch**

```bash
git push -u origin remove-demo-provider 2>&1 | tail -5
```

- [ ] **Step 5.6: Open the PR**

```bash
gh pr create --title "Remove demo AI provider from /playground" --body "$(cat <<'EOF'
## Summary
- Removes the demo AI provider end-to-end: provider class, type-union entry, registry dispatch, all UI affordances (Connect button, Provider label, JDAnalyzer amber notice, T&C copy, playground copy, security copy).
- Hardens `getActiveProvider()` — throws when no session or unknown id; narrowed switch is now TS-exhaustiveness-checked.
- Adds silent migration in `readSession()` so returning visitors with a stale `{providerId: 'demo'}` in sessionStorage degrade gracefully to "not connected" — no error, no banner.
- T&C gate and three real providers (OpenRouter, Anthropic, OpenAI) unchanged.

## Spec
[`docs/superpowers/specs/2026-05-21-remove-demo-provider-design.md`](docs/superpowers/specs/2026-05-21-remove-demo-provider-design.md)

## Test plan
- [x] `bun run build` clean
- [x] `bun run test` — all unit + integration green
- [x] `bunx playwright test` — all E2E green (3 demo specs deleted)
- [ ] CI `build-and-test` passes
- [ ] After deploy, visit `/playground/`, accept terms, open ConnectSheet — confirm 3 options (no demo button)
- [ ] Visit `/security` — confirm no "use demo mode instead" sentence
- [ ] Open DevTools, set `sessionStorage.byok-session = '{"providerId":"demo","token":"x","model":"y"}'`, refresh — confirm visitor sees the "Connect to ask" prompt rather than an error

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5.7: Enable squash auto-merge**

```bash
PR=$(gh pr view --json number --jq '.number')
gh pr merge $PR --auto --squash --repo CAM-eEng/CV
```

- [ ] **Step 5.8: Wait for merge + deploy, then verify live**

After auto-merge fires and deploy completes:

```bash
curl -s https://cameronhartman.dev/playground/ | grep -c "Try demo mode"
# expected: 0

curl -s https://cameronhartman.dev/security/ | grep -c "use demo mode instead"
# expected: 0
```

- [ ] **Step 5.9: Local cleanup**

```bash
git checkout main
git pull --ff-only
git branch -D remove-demo-provider
```

---

## Notes for the implementer

- **`bun` path:** The `bun` binary is at `~/.bun/bin/bun`, not in `$PATH` by default in this environment. Either invoke with the full path or `export PATH="$HOME/.bun/bin:$PATH"` for the session.
- **Branch protection:** `main` requires PRs, requires CI green, requires linear history. Auto-merge with squash handles all three. If CI fails, fix and push a new commit — don't try to fast-forward or admin-override.
- **Stale demo sessions in your own browser:** If you've been testing the playground in this session, your sessionStorage may already contain a demo session. After deploy, the silent migration handles it transparently; you'll just see the "Connect to ask" prompt as expected.
- **`bun.lock` is unaffected:** No dependency changes in this work. Don't regenerate it.
- **PR is likely to land BEHIND main:** Run the merge-main + push cycle from the astro 6 PR playbook if the squash-auto-merge reports `BEHIND`. (`git merge origin/main --no-edit && git push`.)
