# Promote Connect Affordance to Page Level Spec

- **Date:** 2026-05-21
- **Owner:** Cameron Hartman (`CAM-eEng`)
- **Status:** Draft, pending user review
- **Related:** `2026-05-09-cv-design.md` (Plan 2 BYOK architecture), `2026-05-12-ai-playground-hardening.md` (T&C gate, ConnectSheet), `2026-05-21-remove-demo-provider-design.md` (preceding refactor that simplified providers to 3)
- **Predecessor state:** `/playground` renders a T&C modal, an h1 "Playground" title, an intro paragraph, then two React-island sections: `<Chat>` and `<JDAnalyzer>`. The Connect affordance lives only inside `Chat.tsx`'s header — a small underline link "Connect to ask" (disconnected) that swaps to the `<ProviderStatus>` chip (connected). `<JDAnalyzer>` has no visible connect affordance; it silently opens its own `<ConnectSheet>` instance on "Analyze fit" without a session. Both Chat and JDAnalyzer own their own `<ConnectSheet>` modal instances and use a `connectedTick` re-render trick to refresh state.

## 1. Overview

Promote the Connect affordance to the page level — beside the "Playground" title — so visitors immediately see that they need to connect a provider before using either feature. Introduce a new `<ConnectBar>` island that owns the page's single source of truth for connect state + ConnectSheet modal. Replace Chat's and JDAnalyzer's per-component ConnectSheet + Connect button with subscription to a new `cv:session-changed` event for re-rendering, and a `cv:request-connect` event for triggering the page-level sheet when a user tries to interact before connecting.

Single PR. Five files (1 new, 4 modified). Follows the existing `cv:terms-changed` cross-island event pattern in `src/lib/ai/terms.ts`.

## 2. Goals & non-goals

### Goals

- Make connection a visually obvious prerequisite at the top of `/playground`, in line with the title.
- One ConnectSheet instance per page (not three).
- One source of truth for session state at the page level.
- Allow Chat / JDAnalyzer to remain independent React islands — they communicate with `<ConnectBar>` only via global `window.dispatchEvent` (no context, no prop drilling, no cross-island refs).
- Add `cv:session-changed` event in `session.ts` so Chat, JDAnalyzer, and any future feature can react to connect/disconnect.
- Add `cv:request-connect` event so a click on Send / Analyze without a session opens the page-level sheet (one-click flow, no scroll-up required).
- Trim the now-redundant "Connect with your own AI account (OpenRouter, Anthropic, OpenAI)" clause from the intro paragraph since the button surfaces that affordance more obviously.

### Non-goals

- Change anything about the T&C gate. `<TermsGate>` continues to render a full-screen modal that blocks the page until accepted; `<ConnectBar>` sits behind that modal (rendered but visually hidden) until terms are accepted.
- Change the ConnectSheet's UX, the BYOK providers, the OAuth flow, or any provider implementation.
- Add a "Connect" affordance anywhere else (e.g., inside JDAnalyzer or in `<Base>` nav). The page-level slot is the only one.
- Add context-based state management or a Zustand-style store. The CustomEvent pattern is already in use (`cv:terms-changed`) and is sufficient.
- Touch `<ProviderStatus>`'s internals — only its render location moves.

## 3. Behavior changes

| Surface | Before | After |
|---|---|---|
| Page header layout | h1 alone, intro paragraph below | h1 + ConnectBar on one flex row, intro paragraph below |
| Intro paragraph | "Interactive AI features grounded in this site's content. Connect with your own AI account (OpenRouter, Anthropic, OpenAI). See /security..." | "Interactive AI features grounded in this site's content — Chat and a job-description fit analyzer. See /security..." |
| Disconnected, no T&C accepted | T&C modal blocks page; Connect button rendered but invisible behind overlay | Same — visually hidden behind T&C modal |
| Disconnected, T&C accepted | Small underline link "Connect to ask" inside Chat header; JDAnalyzer has no visible affordance | Prominent primary button "Connect ▸" at top of page (next to h1); Chat header has no Connect button; JDAnalyzer continues to have no Connect affordance |
| Connected | ProviderStatus chip inside Chat header; JDAnalyzer header empty | ProviderStatus chip at top of page (next to h1); Chat and JDAnalyzer headers contain no session-related UI |
| User types in Chat without session | Chat opens its own ConnectSheet | Chat dispatches `cv:request-connect`; ConnectBar opens the page-level sheet |
| User clicks "Analyze fit" without session | JDAnalyzer opens its own ConnectSheet | JDAnalyzer dispatches `cv:request-connect`; ConnectBar opens the page-level sheet |
| User picks a provider in the sheet | ConnectSheet → writeSession → component-local `connectedTick` state ticks | ConnectSheet → writeSession → dispatches `cv:session-changed` → all three islands (ConnectBar, Chat, JDAnalyzer) refresh |
| User clicks Disconnect on the chip | clearSession → component-local re-render | clearSession → dispatches `cv:session-changed` → all three islands refresh; ConnectBar swaps chip back to button |

## 4. Event flow + component contracts

### Events (defined in `src/lib/ai/session.ts`)

```ts
const SESSION_CHANGED_EVENT = 'cv:session-changed';
const REQUEST_CONNECT_EVENT = 'cv:request-connect';

export function writeSession(session: Session): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

export function clearSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

export { SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT };
```

`REQUEST_CONNECT_EVENT` is just an exported string constant — dispatch happens in the callers (Chat, JDAnalyzer). Mirrors the `cv:terms-changed` pattern already in `src/lib/ai/terms.ts`.

### `<ConnectBar>` (new — `src/components/byok/ConnectBar.tsx`)

```tsx
import { useState, useEffect } from 'react';
import { ConnectSheet } from './ConnectSheet';
import { ProviderStatus } from './ProviderStatus';
import { readSession, SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT } from '~/lib/ai/session';

export function ConnectBar() {
  const [hasSession, setHasSession] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setHasSession(readSession() !== null);
      setTick((t) => t + 1);
    };
    refresh();
    window.addEventListener(SESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const open = () => setSheetOpen(true);
    window.addEventListener(REQUEST_CONNECT_EVENT, open);
    return () => window.removeEventListener(REQUEST_CONNECT_EVENT, open);
  }, []);

  return (
    <>
      {hasSession ? (
        <ProviderStatus key={tick} onChange={() => setHasSession(false)} />
      ) : (
        <button
          onClick={() => setSheetOpen(true)}
          className="shrink-0 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:opacity-90"
        >
          Connect ▸
        </button>
      )}
      <ConnectSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConnected={() => setSheetOpen(false)}
      />
    </>
  );
}
```

`key={tick}` forces `<ProviderStatus>` to re-mount and re-read sessionStorage when the session changes (its `useEffect` only runs on mount, so without a key bump it would show stale state after Disconnect).

### `<Chat>` (modified — `src/components/chat/Chat.tsx`)

Header simplifies to just the h2 title (no more `hasSession ? ProviderStatus : ConnectButton` ternary). `hasSession` becomes `useState` instead of computed-on-render so it can be a stable subscriber to the session event:

```tsx
const [hasSession, setHasSession] = useState(false);

useEffect(() => {
  const refresh = () => setHasSession(readSession() !== null);
  refresh();
  window.addEventListener(SESSION_CHANGED_EVENT, refresh);
  return () => window.removeEventListener(SESSION_CHANGED_EVENT, refresh);
}, []);
```

In `handleSubmit`:

```ts
if (!hasSession) {
  window.dispatchEvent(new CustomEvent(REQUEST_CONNECT_EVENT));
  return;
}
```

Removed: the in-header Connect button, the `ProviderStatus` reference, the `<ConnectSheet>` JSX, the `sheetOpen` state, the `setConnectedTick` plumbing, the `ProviderStatus`/`ConnectSheet` imports.

### `<JDAnalyzer>` (modified — `src/components/jd-analyzer/JDAnalyzer.tsx`)

Same pattern: subscribe to `SESSION_CHANGED_EVENT`, dispatch `REQUEST_CONNECT_EVENT` on Analyze-without-session, drop the local `<ConnectSheet>` + `sheetOpen` state + `ConnectSheet` import.

### Event flow (first connect)

```
User on /playground (no session)
  ├── Sees Connect button next to "Playground" title
  ├── Path A: clicks Connect button directly
  │     └── ConnectBar opens its ConnectSheet
  └── Path B: tries to send a chat message or analyze a JD
        └── Chat / JDAnalyzer dispatches cv:request-connect
              └── ConnectBar listens, opens its ConnectSheet

User picks provider, completes flow
  └── ConnectSheet writes session via writeSession()
        └── session.ts dispatches cv:session-changed
              ├── ConnectBar refresh() → swaps button for ProviderStatus chip
              ├── Chat refresh() → setHasSession(true); future sends work
              └── JDAnalyzer refresh() → setHasSession(true); Analyze unblocked
```

### Event flow (Disconnect)

```
User clicks "Disconnect" in page-level ProviderStatus
  └── ProviderStatus calls clearSession() then its onChange
        └── session.ts dispatches cv:session-changed
              ├── ConnectBar refresh() → swaps chip back to Connect button
              ├── Chat refresh() → setHasSession(false); next send opens sheet
              └── JDAnalyzer refresh() → setHasSession(false); Analyze re-blocked
```

No cross-component refs, no React context, no prop drilling. Three islands stay independent; they communicate through global `window.dispatchEvent` (same pattern as `cv:terms-changed`).

## 5. Visual placement + responsive behavior

### `playground.astro` layout

```astro
<Base title="Playground" description="Interactive AI features grounded in Cameron's CV">
  <TermsGate client:load />

  <div class="flex items-start justify-between gap-4 mb-2">
    <h1 class="text-3xl font-semibold tracking-tight">Playground</h1>
    <ConnectBar client:load />
  </div>
  <p class="text-neutral-600 dark:text-neutral-400 mb-8">
    Interactive AI features grounded in this site&rsquo;s content — Chat and a job-description
    fit analyzer. See <a href="/security" class="underline underline-offset-4">/security</a>
    for how keys are handled.
  </p>

  <section class="py-6 border-t border-neutral-200 dark:border-neutral-800">
    <Chat cv={cv} client:load />
  </section>

  <section class="py-6 border-t border-neutral-200 dark:border-neutral-800" id="jd-analyzer">
    <h2 class="text-sm uppercase tracking-wider text-neutral-500 mb-4">
      Job-description fit analyzer
    </h2>
    <p class="text-sm text-neutral-500 mb-4">
      Paste a JD; the AI returns a fit score, matched skills, gaps, and a tailored intro. Uses your
      connected provider.
    </p>
    <JDAnalyzer cv={cv} client:visible />
  </section>
</Base>
```

Key change: wrap h1 and `<ConnectBar />` in `flex items-start justify-between gap-4`. `items-start` keeps the h1 anchored to the top so the shorter chip/button aligns with the title's first-line area rather than centering vertically against it.

### Button vs chip styling

**Disconnected (primary button):** `shrink-0 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:opacity-90`. High visual weight = call-to-action.

**Connected (existing ProviderStatus chip):** small gray text with green dot + Disconnect link. Already styled; no changes. Low visual weight = work is done, status indicator.

The asymmetry is deliberate.

### Responsive behavior

- ≥640px (sm+): single flex row, title left, button/chip right
- <640px: single row still. "Playground" h1 ≈ 130px wide at text-3xl; "Connect ▸" button ≈ 100px wide; ProviderStatus chip ≈ 200px wide (longest case: "● Connected · OpenRouter · Disconnect"). At a 320px viewport with `~16px` page padding either side, content area ≈ 288px → tight fit only in the connected state. Acceptable. If overflow occurs at narrowest widths, ProviderStatus is the longer element and would wrap.
- No `sm:flex-row` / `flex-col` switching needed at any current breakpoint.

### Matrix theme compatibility

The button uses `bg-neutral-900 dark:bg-neutral-100`. Matrix theme sets the `dark` class on `<html>` (per `2026-05-11-cv-themes-design.md`), so the button picks up the `dark:` variant. Matrix's `--cv-*` CSS variables don't currently override `bg-neutral-100`. Will visually verify in the dev preview before merging; if the contrast is off under Matrix specifically, swap to `bg-[var(--cv-fg)] text-[var(--cv-bg)]`.

## 6. Test plan

### Unit tests

**`tests/unit/ai-session.test.ts`** — extend with two new tests:
- `it('writeSession dispatches cv:session-changed', ...)` — install a `window.addEventListener(SESSION_CHANGED_EVENT, spy)` listener, call `writeSession`, assert spy called once
- `it('clearSession dispatches cv:session-changed', ...)` — same pattern, call clearSession

**`tests/unit/connect-bar.test.tsx`** (new) — three tests:
- `it('renders the Connect button when no session', ...)` — render `<ConnectBar />`, assert button visible
- `it('renders ProviderStatus chip when session exists', ...)` — write session, render, assert "Connected" text visible, button not visible
- `it('opens the sheet on cv:request-connect', ...)` — render `<ConnectBar />`, dispatch the event, assert `<ConnectSheet>` opens (e.g., dialog role appears)

### Integration tests

`tests/integration/playground-terms-gate.test.ts` — no change expected; T&C gate behavior is independent of ConnectBar. Verify still passes.

### E2E tests

- `tests/e2e/happy-path.spec.ts` — extend with: load `/playground`, accept T&C, click "Connect" button next to h1, verify ConnectSheet opens (~5 added lines)
- `tests/e2e/playground-security.spec.ts` — sweep for any selectors targeting the old in-Chat "Connect to ask" link. None expected (the spec primes sessionStorage directly), but verify
- `tests/e2e/terms-gate.spec.ts` — no change expected; gate is independent

### Tests to verify unaffected (read-only sweep)

- `tests/e2e/theme-toggle.spec.ts`
- `tests/integration/csp-meta.test.ts`
- All other `tests/**/*.ts` — grep for selectors that target `"Connect to ask"`, `ProviderStatus`, or `ConnectSheet` to ensure no breakage from the move

### Test count delta

- Added: ~6 tests (2 session-event + 3 ConnectBar unit + 1 happy-path E2E extension)
- Removed: 0
- Net: +6, all new affordance coverage

## 7. Risks

| Risk | Mitigation |
|---|---|
| ConnectSheet renders twice for one frame during transition (old + new) | Atomic single-commit change: Chat/JDAnalyzer lose their sheets in the same commit that adds ConnectBar |
| Event listeners leak across hot-reload during dev | Standard React `useEffect` cleanup returns; no manual leak |
| User on a stale tab from before this change connects via the in-Chat sheet that no longer exists | After deploy, page reload (or component re-mount) picks up the new code. Sessions are sessionStorage-scoped, so a stale tab without reload has its own active session anyway |
| Chip overflow on very narrow viewports (<320px in connected state) | Acceptable wrap; no special handling needed |
| Matrix theme contrast on the new button | Verify in dev preview before merging |
| Test selectors targeting the old "Connect to ask" link break silently | Grep sweep documented in §6 |

## 8. Out-of-scope follow-ups

- Add a Connect affordance to the global nav for cross-page persistence. The /playground page is currently the only consumer of session state, so a page-level slot is sufficient.
- Replace the CustomEvent bus with a more structured state-management library (Zustand, Jotai, etc.). The current event pattern is in active use (`cv:terms-changed`) and is sufficient at this scale.
- Visual treatment refinement of the disconnected button (color, hover state, icon). Locked to a basic primary button for this spec; iterate based on visual review.
