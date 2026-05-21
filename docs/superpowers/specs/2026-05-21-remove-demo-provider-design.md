# Remove Demo Provider Spec

- **Date:** 2026-05-21
- **Owner:** Cameron Hartman (`CAM-eEng`)
- **Status:** Draft, pending user review
- **Related:** `2026-05-09-cv-design.md` (Plan 2 AI features), `2026-05-12-ai-playground-hardening.md` (PR #50 added the demo-mode UX guard now being removed alongside the provider)
- **Predecessor state:** AI playground at `/playground` ships four BYOK providers — OpenRouter (OAuth), Anthropic (key paste), OpenAI (key paste), and a local demo provider that returns canned answers (chat) and a hardcoded `JDFit` placeholder (JD analyzer). PR #50 (2026-05-12) shipped an inline amber "Demo mode" notice above the JDAnalyzer ResultCard for demo sessions because the canned `JDFit` is the same regardless of input.

## 1. Overview

Remove the demo AI provider from `/playground` end-to-end: provider class, type-union entry, registry dispatch, UI affordances, copy strings, and tests. Keep the T&C gate, the BYOK architecture, and all three real providers (OpenRouter, Anthropic, OpenAI) unchanged.

Returning visitors with a stale `{providerId: 'demo'}` in `sessionStorage` are handled by silent migration: `readSession()` validates `providerId` against the current union and returns `null` for any unknown value, so the visitor's experience is identical to "never connected" — no error, no toast, no banner.

Single PR. The work is tightly coupled (deleting a provider must touch the type union, dispatch, every UI surface that references it, and the tests that exercise it) and there's no intermediate state worth shipping separately.

## 2. Goals & non-goals

### Goals

- Delete the demo provider, its type-union entry, and its dispatch path.
- Remove every UI affordance that references demo (Connect sheet button, ProviderStatus label, JDAnalyzer amber notice, T&C copy phrase, playground page copy, security page copy).
- Tighten `getActiveProvider()`'s contract: throws when no session or unknown provider id, exhaustiveness-checked by TypeScript.
- Silently migrate stale `'demo'` sessions to "not connected" via union validation in `readSession()`.
- Delete tests that exclusively exercise demo; update tests that incidentally use demo to use a real provider id.
- Update auto-memory entries and `src/pages/security.astro` so future docs/AI surfaces don't reference demo.

### Non-goals

- Remove the T&C gate, `TermsGate.tsx`, `terms.ts`, or `hasAcceptedTerms()`. (Initially scoped to include this; user revised on 2026-05-21 — gate stays.)
- Change the three real providers, their dispatch, or their configuration.
- Touch the CSP, DOMPurify config, BYOK key handling, OAuth flow, or any other security control.
- Edit historical specs/plans in `docs/superpowers/{specs,plans}/`. They describe what was designed at a point in time and are preserved intact (same treatment as the LedDisplay 128×64 historical references).
- Rewrite or regenerate `llms.txt` by hand — it's generated and will reflect source changes on the next build.

## 3. Behavior changes

| Surface | Before | After |
|---|---|---|
| `/playground` ConnectSheet | 4 buttons: OpenRouter, Anthropic, OpenAI, Demo | 3 buttons: OpenRouter, Anthropic, OpenAI |
| `/playground` page intro copy | "Connect with your own AI account (…) **or try demo mode**." | "Connect with your own AI account (…)." |
| `/playground` T&C modal point 2 | "(OpenRouter, Anthropic, OpenAI, **or local demo mode**)" | "(OpenRouter, Anthropic, OpenAI)" |
| `/playground` JDAnalyzer after-result | Amber "Demo mode: this is a sample analysis" notice when `providerId === 'demo'` | No notice — real providers always produce real analyses |
| `/playground` ProviderStatus label | Final fallback says `'Demo'` | `'Demo'` fallback removed; switch over remaining three ids |
| `/security` page | Mentions demo mode as a fallback for low-trust sessions | Wording updated to not suggest demo |
| Returning visitor with stale `providerId: 'demo'` | Today: registry dispatches via `case 'demo'` and returns `DemoProvider`. After: session validation rejects the stale id → visitor sees the "Connect to ask" prompt as if they never connected | Silent. No error, no banner, no toast. |
| New visitor (no session) | Today: `getActiveProvider` defaults to `DemoProvider` if no session, but in practice callers (Chat:51, JDAnalyzer:38) guard with `readSession()` first and open ConnectSheet. After: `getActiveProvider` throws if called without a session (unreachable in normal flow; contract assertion) | No visible difference. |
| Returning visitor with valid OpenRouter/Anthropic/OpenAI session | Unchanged | Unchanged |

## 4. Error contract + sessionStorage validation

### `ProviderId` union (`src/lib/ai/provider.ts`)

```ts
export type ProviderId = 'openrouter' | 'anthropic' | 'openai';  // was: ... | 'demo'
```

### `getActiveProvider` (`src/lib/ai/registry.ts`)

New contract: caller must have verified a session exists before invoking. Throws otherwise.

```ts
export function getActiveProvider(systemPrompt: string): AIProvider {
  const s = readSession();
  if (!s) throw new Error('No active provider session — connect a provider first.');
  switch (s.providerId) {
    case 'anthropic':  return new AnthropicProvider(s.token, systemPrompt);
    case 'openai':     return new OpenAIProvider(s.token, systemPrompt);
    case 'openrouter': return new OpenRouterProvider(s.token, systemPrompt);
  }
}
```

The narrowed `ProviderId` union turns the switch into a TypeScript exhaustiveness check — any future provider addition that forgets a branch errors at compile time. Both existing callers (`Chat.tsx:51`, `JDAnalyzer.tsx:38`) already guard with `readSession()` before invoking, so the throw is unreachable in normal flow. It's a contract assertion, not a runtime path.

### `readSession` (`src/lib/ai/session.ts`)

Silent migration via union validation. The single new line is the `VALID_PROVIDER_IDS` check.

```ts
const VALID_PROVIDER_IDS: readonly ProviderId[] = ['openrouter', 'anthropic', 'openai'];

export function readSession(): Session | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.providerId || typeof parsed.token !== 'string' || !parsed.model) return null;
    if (!VALID_PROVIDER_IDS.includes(parsed.providerId)) return null;  // ← new line
    return parsed;
  } catch {
    return null;
  }
}
```

Returns `null` (rather than throwing or clearing the slot) so stale sessions behave like "never connected." Side benefit: the same validation defends against any future provider rename or otherwise-corrupt session payload, not just demo. No side effects in `readSession` — the next `writeSession()` overwrites the slot naturally.

## 5. Files touched

### Source code — edits

- `src/lib/ai/provider.ts` — remove `'demo'` from `ProviderId` union (1 line)
- `src/lib/ai/registry.ts` — drop demo import + `if (!s) return new DemoProvider()` fallback + `case 'demo'` branch; replace fallback with `throw`
- `src/lib/ai/session.ts` — add `VALID_PROVIDER_IDS` constant + the union-membership check in `readSession()` (~3 lines)
- `src/components/byok/ConnectSheet.tsx` — delete `startDemo` function (4 lines) and the demo button (9 lines)
- `src/components/byok/ProviderStatus.tsx` — drop the `'Demo'` fallback from the label ternary (1 line)
- `src/components/jd-analyzer/JDAnalyzer.tsx` — delete the amber demo-mode notice block (9 lines)
- `src/components/byok/TermsGate.tsx` — strip ", or local demo mode" from T&C copy (1 line)
- `src/pages/playground.astro` — strip "or try demo mode" from intro copy (1 line)
- `src/pages/security.astro` — reword line 30 so it doesn't suggest demo as a low-trust fallback

### Source code — deletes

- `src/lib/ai/demo.ts` — full file delete (87 lines)

### Tests — deletes

- `tests/unit/ai-demo-provider.test.ts` — 6 tests on DemoProvider's regex-keyed canned answers
- `tests/e2e/chat-demo.spec.ts` — chat-via-demo flow; OpenRouter/Anthropic/OpenAI chat flows have their own coverage
- `tests/e2e/jd-analyzer-demo.spec.ts` — JD analyzer demo flow; same reasoning

### Tests — edits

- `tests/unit/ai-registry.test.ts`:
  - Delete `import { DemoProvider }`
  - Replace `it('returns DemoProvider when no session is set')` with `it('throws when no session is set')` asserting `getActiveProvider` throws
  - Delete the demo switch-case test
  - Add `it('throws on unknown providerId')` — manually craft a session with an invalid id, assert throw
- `tests/unit/ai-session.test.ts`:
  - Change the `writeSession({ providerId: 'demo', ... })` line to a valid id (e.g., `'anthropic'`) for whatever assertion it's part of
  - Add `it('silently returns null when sessionStorage holds a stale demo providerId')` — manually inject the stale shape, assert `readSession()` returns `null`
- `tests/e2e/playground-security.spec.ts:34`:
  - Currently primes sessionStorage with a demo session to bypass connect for rate-limit testing
  - Change to a fake-but-valid provider session (e.g., `{providerId: 'openrouter', token: 'fake', model: 'gpt-4o-mini'}`); the rate-limit guard triggers before any provider call, so the fake token never matters
  - Verify by reading the test that nothing actually awaits a provider response

### Tests — verify (read-only, no edits expected)

- `tests/integration/playground-terms-gate.test.ts` — T&C gate stays; should not need changes. Grep to confirm.
- `grep -ril demo tests/` after all edits — should return nothing.

### Docs — auto-memory

`~/.claude/projects/-home-dexter/memory/project_cv.md`:
- BYOK paragraph — change "(OpenRouter OAuth, Anthropic key paste, OpenAI key paste, or local demo mode)" → "(OpenRouter OAuth, Anthropic key paste, OpenAI key paste)"
- Delete the `Demo provider in src/lib/ai/demo.ts…` line entirely
- Plan 6 follow-up patches — rewrite the PR #50 clause: `PR #50 (2026-05-12) shipped an inline amber "Demo mode" notice above the JDAnalyzer ResultCard for demo sessions. The demo provider and that notice were both removed on 2026-05-21 in PR #<TBD>; the notice + DemoProvider class + ai-demo-provider/chat-demo/jd-analyzer-demo tests are gone. Don't reference demo.ts or providerId === 'demo' in new code.`
- Astro 6 debugging section — leave the `chat-demo` mention as-is (it's historical evidence of which E2E tests failed during astro 6 debugging, not a forward-looking claim)

### Docs — explicitly NOT edited

- `docs/superpowers/specs/2026-05-09-cv-design.md` (8 demo refs)
- `docs/superpowers/specs/2026-05-12-ai-playground-hardening.md`
- `docs/superpowers/plans/2026-05-09-cv-foundation.md`
- `docs/superpowers/plans/2026-05-11-cv-ai-features.md`
- `docs/superpowers/plans/2026-05-12-ai-playground-hardening.md`

These describe what was designed/planned at the time. Preserve the decision trail intact, same treatment as LedDisplay's 128×64 historical references.

### Docs — `TODO.md`

`grep -i demo TODO.md` returned zero hits at spec-writing time. Re-grep right before commit in case the nightly refresh added anything.

## 6. Test coverage delta

- Removed: 3 files (~16 tests by file count: 6 unit + ~5 chat E2E + ~5 JD E2E)
- Added: 3 tests (throws-when-no-session, throws-on-unknown-id, stale-demo-migrates-to-null)
- Net: ~−13 tests, all justified by feature removal
- Acceptance: full `bun run test` and full `bunx playwright test` both green locally before push; CI replicates

## 7. Risks

| Risk | Mitigation |
|---|---|
| A returning visitor with a stale demo session sees a confusing state | Silent migration in `readSession()` collapses to "not connected" — same UI as a brand-new visitor |
| A new provider added later forgets to extend `VALID_PROVIDER_IDS` and silently fails union validation | Compile-time exhaustiveness check in `getActiveProvider`'s switch; lint-time obviousness in `session.ts` since the array is right above the type usage |
| An orphan demo reference somewhere I missed | Final `grep -ri demo src/ tests/` sweep before commit; build + full test run must be green |
| A test was incidentally relying on `DemoProvider` as a generic test fixture | Inventory above is exhaustive based on `grep -ril demo src/ tests/`; the playground-security spec is the only incidental case and is handled |
| `llms.txt` or other generated artifacts leak a stale demo reference | They regenerate at build; verify the deployed `/llms.txt` after the deploy completes |

## 8. Out-of-scope follow-ups

- Removing the T&C gate (`TermsGate.tsx`, `terms.ts`, `hasAcceptedTerms` gating in Chat/JDAnalyzer). The user revised scope on 2026-05-21 to keep it. If reconsidered later, that's its own spec with its own decisions about where the 5 disclaimer points live.
- Updating historical specs/plans in `docs/superpowers/`. Treated as immutable.
- Refactoring `getActiveProvider` to return a Result/Either instead of throwing. The throw is unreachable in normal flow; a Result type would be over-engineering for an assertion.
