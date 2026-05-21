# Promote Connect Affordance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the Connect affordance to the top of `/playground` (next to the h1) via a new `<ConnectBar>` island. Replace each component's local `<ConnectSheet>` with cross-island `cv:session-changed` / `cv:request-connect` CustomEvents so the page has one Connect button and one ConnectSheet.

**Architecture:** New `<ConnectBar>` island owns the page-level connect UI (button when disconnected, ProviderStatus chip when connected) and the single `<ConnectSheet>` instance. `writeSession`/`clearSession` in `session.ts` dispatch `cv:session-changed` so Chat, JDAnalyzer, and ConnectBar all stay in sync. Chat and JDAnalyzer drop their internal sheets and dispatch `cv:request-connect` when a user tries to submit/analyze without a session. Mirrors the existing `cv:terms-changed` pattern in `terms.ts`.

**Tech Stack:** Astro 6 + React 19 islands + TypeScript 5 strict + Bun + Tailwind 4. Vitest (unit) + Playwright (E2E). Existing React component test pattern uses `@testing-library/react` (see `tests/unit/key-paste-form.test.tsx` for prior art).

**Spec:** [`docs/superpowers/specs/2026-05-21-promote-connect-affordance-design.md`](../specs/2026-05-21-promote-connect-affordance-design.md)

---

## Prerequisites

- Working directory: `/home/dexter/Projects/CV`
- Branch: `promote-connect-affordance` (already exists; spec doc is at HEAD)
- Working tree clean
- Bun installed at `~/.bun/bin/bun`
- Playwright chromium installed (from `bunx playwright install chromium`)

Confirm before starting:

```bash
cd /home/dexter/Projects/CV
git status                       # expect: clean, on promote-connect-affordance
git log --oneline -2             # expect: top commit is the spec doc (28b8b2e)
git fetch origin main && git log --oneline origin/main..HEAD  # see what's ahead of main
```

If main has moved meaningfully since the branch was cut, merge it in:

```bash
git merge origin/main --no-edit
```

---

## Task 1: Add cv:session-changed event dispatch to session.ts

**Files:**
- Modify: `src/lib/ai/session.ts` — dispatch event from `writeSession` and `clearSession`, export event-name constants
- Test: `tests/unit/ai-session.test.ts` — add two new tests

Mirrors the `terms.ts` pattern. `REQUEST_CONNECT_EVENT` is exported as a constant only — dispatch happens in callers (Tasks 4 and 5), not in session.ts itself.

- [ ] **Step 1.1: Write the failing tests**

Append to the end of the `describe('BYOK session storage', ...)` block in `tests/unit/ai-session.test.ts`, before the closing `});`:

```ts
  it('writeSession dispatches cv:session-changed', () => {
    const spy = vi.fn();
    window.addEventListener('cv:session-changed', spy);
    writeSession({ providerId: 'anthropic', token: 'sk-ant-x', model: 'claude-opus-4-7' });
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('cv:session-changed', spy);
  });

  it('clearSession dispatches cv:session-changed', () => {
    writeSession({ providerId: 'anthropic', token: 'sk-ant-x', model: 'claude-opus-4-7' });
    const spy = vi.fn();
    window.addEventListener('cv:session-changed', spy);
    clearSession();
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('cv:session-changed', spy);
  });
```

You'll also need to import `vi` from vitest. Verify the existing import line at the top of the file — if `vi` isn't already imported, change:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
```

to:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
```

- [ ] **Step 1.2: Run the new tests to verify they fail**

```bash
~/.bun/bin/bun run test tests/unit/ai-session.test.ts -t "dispatches" 2>&1 | tail -15
```

Expected: FAIL — `spy` is never called because writeSession/clearSession don't dispatch yet.

- [ ] **Step 1.3: Implement event dispatch in session.ts**

Edit `src/lib/ai/session.ts`. After the existing `const KEY = 'byok-session';` line, add:

```ts
const SESSION_CHANGED_EVENT = 'cv:session-changed';
const REQUEST_CONNECT_EVENT = 'cv:request-connect';
```

In `writeSession`, add the dispatch as the last line of the function body:

```ts
export function writeSession(session: Session): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}
```

In `clearSession`, add the dispatch as the last line:

```ts
export function clearSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}
```

Export both event constants at the end of the file:

```ts
export { SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT };
```

- [ ] **Step 1.4: Run the new tests to verify they pass**

```bash
~/.bun/bin/bun run test tests/unit/ai-session.test.ts 2>&1 | tail -10
```

Expected: PASS — all session tests green.

- [ ] **Step 1.5: Run the full test suite to ensure nothing broke**

```bash
~/.bun/bin/bun run test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/ai/session.ts tests/unit/ai-session.test.ts
git commit -m "$(cat <<'EOF'
feat(session): dispatch cv:session-changed on write/clear

Adds CustomEvent dispatch from writeSession and clearSession so other
islands (Chat, JDAnalyzer, the new ConnectBar) can react to connect
and disconnect without polling sessionStorage. Also exports a
REQUEST_CONNECT_EVENT constant for callers that want to trigger the
page-level ConnectSheet without owning their own. Mirrors the
cv:terms-changed pattern already in src/lib/ai/terms.ts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create ConnectBar component

**Files:**
- Create: `src/components/byok/ConnectBar.tsx`
- Test: `tests/unit/connect-bar.test.tsx`

Self-contained island. After this task it exists in the codebase but isn't rendered anywhere yet — Task 3 wires it into `playground.astro`.

- [ ] **Step 2.1: Write the failing tests**

Create `tests/unit/connect-bar.test.tsx` with this content:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ConnectBar } from '~/components/byok/ConnectBar';
import { REQUEST_CONNECT_EVENT, SESSION_CHANGED_EVENT } from '~/lib/ai/session';

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ConnectBar', () => {
  it('renders the Connect button when no session is set', () => {
    render(<ConnectBar />);
    expect(screen.getByRole('button', { name: /^connect/i })).toBeInTheDocument();
  });

  it('renders the ProviderStatus chip when a session exists', () => {
    sessionStorage.setItem(
      'byok-session',
      JSON.stringify({ providerId: 'anthropic', token: 'sk-x', model: 'claude-opus-4-7' }),
    );
    render(<ConnectBar />);
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    // Button shouldn't be present; only the "Disconnect" button from the chip
    expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument();
  });

  it('opens the ConnectSheet when cv:request-connect is dispatched', () => {
    render(<ConnectBar />);
    // ConnectSheet is closed before the event
    expect(screen.queryByRole('heading', { name: /connect to ask/i })).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(REQUEST_CONNECT_EVENT));
    });
    expect(screen.getByRole('heading', { name: /connect to ask/i })).toBeInTheDocument();
  });

  it('swaps from button to chip when SESSION_CHANGED_EVENT fires', () => {
    render(<ConnectBar />);
    expect(screen.getByRole('button', { name: /^connect/i })).toBeInTheDocument();

    act(() => {
      sessionStorage.setItem(
        'byok-session',
        JSON.stringify({ providerId: 'anthropic', token: 'sk-x', model: 'claude-opus-4-7' }),
      );
      window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
    });

    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument();
  });

  it('opens the ConnectSheet when the Connect button is clicked', () => {
    render(<ConnectBar />);
    fireEvent.click(screen.getByRole('button', { name: /^connect/i }));
    expect(screen.getByRole('heading', { name: /connect to ask/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run the tests to verify they fail**

```bash
~/.bun/bin/bun run test tests/unit/connect-bar.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '~/components/byok/ConnectBar'` (the file doesn't exist yet).

- [ ] **Step 2.3: Create the ConnectBar component**

Create `src/components/byok/ConnectBar.tsx` with this content:

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

The `key={tick}` on `<ProviderStatus>` forces it to re-mount when the session changes, so it re-reads sessionStorage. (Its internal `useEffect` only runs on mount.)

- [ ] **Step 2.4: Run the tests to verify they pass**

```bash
~/.bun/bin/bun run test tests/unit/connect-bar.test.tsx 2>&1 | tail -10
```

Expected: PASS — all 5 ConnectBar tests green.

- [ ] **Step 2.5: Run the full unit test suite**

```bash
~/.bun/bin/bun run test 2>&1 | tail -5
```

Expected: all tests pass (count higher than before because of the new tests).

- [ ] **Step 2.6: Run lint to confirm formatting is clean**

```bash
~/.bun/bin/bun run lint 2>&1 | tail -5
```

Expected: no Prettier or ESLint complaints.

- [ ] **Step 2.7: Build to confirm everything compiles**

```bash
~/.bun/bin/bun run build 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 2.8: Commit**

```bash
git add src/components/byok/ConnectBar.tsx tests/unit/connect-bar.test.tsx
git commit -m "$(cat <<'EOF'
feat(byok): add ConnectBar island for page-level connect affordance

New React island that shows a primary Connect button when no session
exists and the existing ProviderStatus chip when connected. Owns a
single ConnectSheet instance and listens for cv:request-connect
events so callers (Chat, JDAnalyzer in follow-up commits) can trigger
the sheet without owning their own. Subscribes to cv:session-changed
so the button/chip swap is automatic on connect/disconnect.

Not yet wired into playground.astro — that's the next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire ConnectBar into playground.astro

**Files:**
- Modify: `src/pages/playground.astro`

After this task, the page renders `<ConnectBar>` next to the h1. Chat and JDAnalyzer still own their own ConnectSheets at this point — that's two ConnectSheets on the page, both functional but only one (ConnectBar's) actually triggered by visible UI. The user can still trigger the in-Chat one by clicking the "Connect to ask" link in the Chat header, which still exists. This intermediate state is removed in Tasks 4 and 5. The squash-merge to main collapses everything, so main never sees the intermediate.

- [ ] **Step 3.1: Edit `src/pages/playground.astro`**

Replace the file contents with:

```astro
---
import Base from '~/layouts/Base.astro';
import { Chat } from '~/components/chat/Chat';
import { JDAnalyzer } from '~/components/jd-analyzer/JDAnalyzer';
import { TermsGate } from '~/components/byok/TermsGate';
import { ConnectBar } from '~/components/byok/ConnectBar';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
---

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

The three changes vs prior file:
1. New `import { ConnectBar } from '~/components/byok/ConnectBar';`
2. h1 wrapped in `<div class="flex items-start justify-between gap-4 mb-2">` alongside `<ConnectBar client:load />`
3. Intro paragraph rephrased — "Connect with your own AI account (OpenRouter, Anthropic, OpenAI)" replaced with "Chat and a job-description fit analyzer"

- [ ] **Step 3.2: Build to confirm everything compiles**

```bash
~/.bun/bin/bun run build 2>&1 | tail -5
```

Expected: build succeeds, `[build] 9 page(s) built in …`.

- [ ] **Step 3.3: Run the full test suite**

```bash
~/.bun/bin/bun run test 2>&1 | tail -5
```

Expected: all unit + integration tests pass. (No new tests in this task; existing tests still pass.)

- [ ] **Step 3.4: Commit**

```bash
git add src/pages/playground.astro
git commit -m "$(cat <<'EOF'
ui(playground): wire ConnectBar into page header

Wraps the Playground h1 + ConnectBar in a flex row so the Connect
button (or ProviderStatus chip when connected) sits next to the
title, making it visually obvious that connection is required.
Trims the now-redundant "Connect with your own AI account
(OpenRouter, Anthropic, OpenAI)" clause from the intro paragraph.

Chat and JDAnalyzer still own their internal ConnectSheets at this
point — they're refactored to use cv:request-connect in follow-up
commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Refactor Chat.tsx to subscribe to session events + dispatch request-connect

**Files:**
- Modify: `src/components/chat/Chat.tsx`

Removes the in-Chat ConnectSheet, the "Connect to ask" button, the ProviderStatus chip, the `sheetOpen` state, and the `connectedTick` plumbing. Replaces them with a subscription to `cv:session-changed` for re-render and a dispatch of `cv:request-connect` on submit-without-session.

- [ ] **Step 4.1: Read the current file and identify the changes**

```bash
sed -n '1,60p' src/components/chat/Chat.tsx
```

Locate:
- The import line for `ConnectSheet` (around line 5)
- The import line for `ProviderStatus` (around line 6)
- The `connectedTick` and `sheetOpen` useState lines (around lines 31-32)
- The `connectedTick` useEffect (around lines 43-45)
- The `hasSession` const declaration (around line 47)
- The `if (!hasSession)` early-return guard in `handleSubmit` that opens the sheet (around lines 51-54)
- The header JSX with `hasSession ? <ProviderStatus> : <button>Connect to ask</button>` (around lines 113-123)
- The `<ConnectSheet>` JSX at the end of the return (around lines 153-160)

- [ ] **Step 4.2: Replace the file with the refactored version**

Write the new contents of `src/components/chat/Chat.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { Message } from './Message';
import { InputBox } from './InputBox';
import { CacheStat } from './CacheStat';
import { getActiveProvider } from '~/lib/ai/registry';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import { readSession, SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT } from '~/lib/ai/session';
import { hasAcceptedTerms, TERMS_CHANGED_EVENT } from '~/lib/ai/terms';
import {
  MAX_CHAT_MESSAGES_PER_SESSION,
  incChatCount,
  getChatCount,
  chatLimitReached,
  trimHistory,
} from '~/lib/ai/limits';
import { filter } from '~/lib/ai/moderation';
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
  const [accepted, setAccepted] = useState<boolean>(false);
  const [hasSession, setHasSession] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const refresh = () => setAccepted(hasAcceptedTerms());
    refresh();
    window.addEventListener(TERMS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TERMS_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setHasSession(readSession() !== null);
    refresh();
    window.addEventListener(SESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, refresh);
  }, []);

  const systemPrompt = buildSystemPrompt(cv);

  async function handleSubmit(text: string) {
    if (!hasSession) {
      window.dispatchEvent(new CustomEvent(REQUEST_CONNECT_EVENT));
      return;
    }
    if (chatLimitReached()) {
      setMessages([
        ...messages,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content: `_Session limit reached (${MAX_CHAT_MESSAGES_PER_SESSION} messages). Close and reopen this tab to reset._`,
        },
      ]);
      return;
    }
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setPendingAssistant('');
    setBusy(true);
    setCachedTokens(0);
    incChatCount();

    const provider = getActiveProvider(systemPrompt);
    abortRef.current = new AbortController();
    let accumulated = '';
    try {
      for await (const chunk of provider.chat({
        messages: trimHistory(next),
        signal: abortRef.current.signal,
      })) {
        if (chunk.type === 'text') {
          accumulated += chunk.delta;
          setPendingAssistant(filter(accumulated).sanitized);
        } else if (chunk.type === 'cache-info') {
          setCachedTokens(chunk.cachedTokens);
        }
      }
    } catch (e) {
      accumulated += `\n\n_Error: ${e instanceof Error ? e.message : String(e)}_`;
    }
    setMessages([...next, { role: 'assistant', content: filter(accumulated).sanitized }]);
    setPendingAssistant('');
    setBusy(false);
  }

  if (!accepted) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500">Chat with my CV</h2>
        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-6 text-sm text-neutral-700 dark:text-neutral-300">
          Accept the playground terms above to use the chat.
        </div>
      </div>
    );
  }

  const count = getChatCount();
  const showCounter = count >= 30;

  return (
    <div className="space-y-4">
      <h2 className="text-sm uppercase tracking-wider text-neutral-500">Chat with my CV</h2>

      <div className="space-y-3 min-h-[8rem]">
        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}
        {pendingAssistant && <Message role="assistant" content={pendingAssistant} />}
        {messages.length === 0 && !pendingAssistant && (
          <p className="text-sm text-neutral-500 italic">
            Ask anything about Cameron's work — embedded experience, the LitePoint AI project, side
            projects, education.
          </p>
        )}
      </div>

      {showCounter && (
        <p className="text-xs text-neutral-500">
          Messages this session: {count} / {MAX_CHAT_MESSAGES_PER_SESSION}
        </p>
      )}

      <div className="space-y-2">
        <InputBox disabled={busy} onSubmit={handleSubmit} />
        <div className="flex items-center justify-between text-xs">
          <CacheStat tokens={cachedTokens} />
          <span className="text-neutral-500">{busy ? 'thinking…' : ''}</span>
        </div>
      </div>
    </div>
  );
}
```

Removed compared to before:
- `import { ConnectSheet } from '~/components/byok/ConnectSheet';`
- `import { ProviderStatus } from '~/components/byok/ProviderStatus';`
- `const [sheetOpen, setSheetOpen] = useState(false);`
- `const [connectedTick, setConnectedTick] = useState(0);`
- `useEffect(() => { /* connectedTick re-render trigger */ }, [connectedTick]);`
- The `hasSession` const-from-render (replaced with useState + subscription)
- The header JSX wrapping `<h2>` in a flex row with the Connect button / ProviderStatus
- The `<ConnectSheet>` JSX at the end

Added:
- `import { readSession, SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT } from '~/lib/ai/session';` (note: `readSession` was already imported, but the import line now includes the two event constants too)
- `const [hasSession, setHasSession] = useState<boolean>(false);`
- Second `useEffect` subscribing to `SESSION_CHANGED_EVENT`
- In `handleSubmit`, the `!hasSession` branch dispatches `cv:request-connect` instead of setting local sheet state

- [ ] **Step 4.3: Build to confirm everything compiles**

```bash
~/.bun/bin/bun run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 4.4: Run the full test suite**

```bash
~/.bun/bin/bun run test 2>&1 | tail -5
```

Expected: all tests pass. (No existing test asserted on the removed in-Chat Connect button; if one shows up red, read it and update its selector to reflect the new ConnectBar at page level.)

- [ ] **Step 4.5: Run lint**

```bash
~/.bun/bin/bun run lint 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/chat/Chat.tsx
git commit -m "$(cat <<'EOF'
refactor(chat): drop local ConnectSheet; use page-level ConnectBar

Removes Chat's internal ConnectSheet instance, the "Connect to ask"
header link, the ProviderStatus chip, and the sheetOpen/connectedTick
state plumbing. Subscribes to cv:session-changed to keep hasSession
in sync. On submit-without-session, dispatches cv:request-connect so
the page-level ConnectBar opens its single ConnectSheet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Refactor JDAnalyzer.tsx to subscribe to session events + dispatch request-connect

**Files:**
- Modify: `src/components/jd-analyzer/JDAnalyzer.tsx`

Same pattern as Task 4. JDAnalyzer drops its internal `<ConnectSheet>`, replaces the `if (!readSession()) setSheetOpen(true)` guard with a dispatch of `cv:request-connect`.

- [ ] **Step 5.1: Read the current file**

```bash
cat src/components/jd-analyzer/JDAnalyzer.tsx
```

Locate:
- The `import { ConnectSheet } from '~/components/byok/ConnectSheet';` line
- The `const [sheetOpen, setSheetOpen] = useState(false);` line
- The `if (!readSession()) { setSheetOpen(true); return; }` block in `analyze()`
- The `<ConnectSheet>` JSX at the end of the return

- [ ] **Step 5.2: Replace the file with the refactored version**

Write the new contents of `src/components/jd-analyzer/JDAnalyzer.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ResultCard } from './ResultCard';
import { getActiveProvider } from '~/lib/ai/registry';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import { readSession, SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT } from '~/lib/ai/session';
import { JDFitSchema, type JDFit, buildJDPromptBody } from '~/lib/ai/jd-schema';
import { hasAcceptedTerms, TERMS_CHANGED_EVENT } from '~/lib/ai/terms';
import {
  MAX_TEXT_INPUT_CHARS,
  MAX_JD_ANALYSES_PER_SESSION,
  incJDCount,
  getJDCount,
  jdLimitReached,
} from '~/lib/ai/limits';
import { filter } from '~/lib/ai/moderation';
import type { CV } from '~/lib/content/cv-schema';

export function JDAnalyzer({ cv }: { cv: CV }) {
  const [jd, setJd] = useState('');
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState<JDFit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<boolean>(false);
  const [hasSession, setHasSession] = useState<boolean>(false);

  useEffect(() => {
    const refresh = () => setAccepted(hasAcceptedTerms());
    refresh();
    window.addEventListener(TERMS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TERMS_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setHasSession(readSession() !== null);
    refresh();
    window.addEventListener(SESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, refresh);
  }, []);

  const systemPrompt = buildSystemPrompt(cv);

  async function analyze() {
    if (!jd.trim()) return;
    if (!hasSession) {
      window.dispatchEvent(new CustomEvent(REQUEST_CONNECT_EVENT));
      return;
    }
    if (jdLimitReached()) {
      setErr(
        `Session limit reached (${MAX_JD_ANALYSES_PER_SESSION} analyses). Close and reopen this tab to reset.`,
      );
      return;
    }
    setBusy(true);
    setErr(null);
    setFit(null);
    incJDCount();
    try {
      const provider = getActiveProvider(systemPrompt);
      const body = buildJDPromptBody(jd, cv.basics.summary);
      const result = await provider.structured({ prompt: body, schema: JDFitSchema });
      const moderated: JDFit = {
        ...result,
        tailored_intro: filter(result.tailored_intro).sanitized,
        gaps: result.gaps.map((g) => filter(g).sanitized),
        suggested_questions: result.suggested_questions.map((q) => filter(q).sanitized),
        matched_skills: result.matched_skills.map((m) => ({
          skill: filter(m.skill).sanitized,
          evidence: m.evidence,
        })),
      };
      setFit(moderated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!accepted) {
    return (
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-6 text-sm text-neutral-700 dark:text-neutral-300">
        Accept the playground terms above to use the JD analyzer.
      </div>
    );
  }

  const pct = jd.length / MAX_TEXT_INPUT_CHARS;
  const counterColor =
    pct >= 0.95
      ? 'text-red-600 dark:text-red-400'
      : pct >= 0.8
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-neutral-500 dark:text-neutral-400';
  const count = getJDCount();
  const showCounter = count >= MAX_JD_ANALYSES_PER_SESSION - 3;

  return (
    <div className="space-y-4">
      {showCounter && (
        <p className="text-xs text-neutral-500">
          Analyses this session: {count} / {MAX_JD_ANALYSES_PER_SESSION}
        </p>
      )}
      <div className="space-y-1">
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          maxLength={MAX_TEXT_INPUT_CHARS}
          placeholder="Paste a job description here…"
          rows={6}
          className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm resize-y"
        />
        <div className={`text-xs text-right tabular-nums ${counterColor}`}>
          {jd.length} / {MAX_TEXT_INPUT_CHARS}
        </div>
      </div>
      <button
        onClick={analyze}
        disabled={busy || !jd.trim()}
        className="px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm disabled:opacity-50"
      >
        {busy ? 'Analyzing…' : 'Analyze fit'}
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {fit && <ResultCard fit={fit} />}
    </div>
  );
}
```

Removed compared to before:
- `import { ConnectSheet } from '~/components/byok/ConnectSheet';`
- `const [sheetOpen, setSheetOpen] = useState(false);`
- The `if (!readSession()) { setSheetOpen(true); return; }` block
- The `<ConnectSheet>` JSX at the end

Added:
- `SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT` to the `readSession` import line
- `const [hasSession, setHasSession] = useState<boolean>(false);`
- A second `useEffect` subscribing to `SESSION_CHANGED_EVENT`
- In `analyze()`, the `!hasSession` branch dispatches `cv:request-connect`

- [ ] **Step 5.3: Build to confirm everything compiles**

```bash
~/.bun/bin/bun run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 5.4: Run the full test suite**

```bash
~/.bun/bin/bun run test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5.5: Run lint**

```bash
~/.bun/bin/bun run lint 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 5.6: Commit**

```bash
git add src/components/jd-analyzer/JDAnalyzer.tsx
git commit -m "$(cat <<'EOF'
refactor(jd-analyzer): drop local ConnectSheet; use page-level ConnectBar

Removes JDAnalyzer's internal ConnectSheet instance and sheetOpen
state. Subscribes to cv:session-changed for hasSession reactivity.
On analyze-without-session, dispatches cv:request-connect so the
page-level ConnectBar opens its single ConnectSheet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add E2E coverage for the page-level Connect button

**Files:**
- Create: `tests/e2e/connect-bar.spec.ts`

Small self-contained spec. Doesn't extend an existing file because I haven't read its structure — keeping the addition isolated.

- [ ] **Step 6.1: Create the E2E spec**

Create `tests/e2e/connect-bar.spec.ts` with this content:

```ts
import { test, expect } from '@playwright/test';

test.describe('ConnectBar', () => {
  test('Connect button appears next to the Playground title and opens the sheet', async ({
    page,
  }) => {
    // Pre-accept T&C so the modal doesn't block the page
    await page.addInitScript(() => {
      sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
    });
    await page.goto('/playground/');

    // Title is visible
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible();

    // Page-level Connect button is visible
    const connectButton = page.getByRole('button', { name: /^Connect/i });
    await expect(connectButton).toBeVisible();

    // Clicking it opens the ConnectSheet
    await connectButton.click();
    await expect(page.getByRole('heading', { name: /connect to ask/i })).toBeVisible();
  });

  test('Submitting in Chat without a session opens the ConnectSheet via the page-level bar', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('ai-terms-accepted-v1', 'yes');
    });
    await page.goto('/playground/');

    // Type something and submit in the Chat textarea
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('hello');
    await page.keyboard.press('Enter');

    // The ConnectSheet (owned by ConnectBar) opens
    await expect(page.getByRole('heading', { name: /connect to ask/i })).toBeVisible();
  });
});
```

- [ ] **Step 6.2: Run the new E2E spec locally**

```bash
PATH="$HOME/.bun/bin:$PATH" timeout 60 ~/.bun/bin/bunx playwright test tests/e2e/connect-bar.spec.ts --reporter=line --workers=1 2>&1 | tail -10
```

Expected: 2/2 pass.

- [ ] **Step 6.3: Run the full Playwright suite to check for regressions**

```bash
PATH="$HOME/.bun/bin:$PATH" timeout 300 ~/.bun/bin/bunx playwright test --reporter=line --workers=2 2>&1 | tail -15
```

Expected: all tests pass. If any existing test (e.g., `playground-security.spec.ts`, `terms-gate.spec.ts`, `theme-toggle.spec.ts`) breaks because it targeted the old in-Chat "Connect to ask" link or the in-Chat ConnectSheet, update its selector to use the new page-level button or ConnectBar.

- [ ] **Step 6.4: Commit**

```bash
git add tests/e2e/connect-bar.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover page-level ConnectBar flow

Two new E2E tests: (1) the Connect button next to the Playground
title is visible and opens the ConnectSheet when clicked; (2)
submitting in Chat without a session opens the ConnectSheet via the
cv:request-connect event path (verifies the cross-island event bus
works end-to-end).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification, push, PR, auto-merge

**Files:** None modified.

- [ ] **Step 7.1: Final orphan-reference sweep**

```bash
grep -rn "sheetOpen\|ConnectSheet" src/components/chat/ src/components/jd-analyzer/ 2>&1
```

Expected: zero matches. Chat and JDAnalyzer no longer reference `sheetOpen` state or import `ConnectSheet`.

```bash
grep -rn "Connect to ask" src/ 2>&1
```

Expected: zero matches in src/. ("Connect to ask" was the old in-Chat link copy; the new page-level button reads "Connect ▸".)

- [ ] **Step 7.2: Build + full unit + integration tests**

```bash
~/.bun/bin/bun run build 2>&1 | tail -3
~/.bun/bin/bun run test 2>&1 | tail -5
```

Expected: build clean, all tests pass.

- [ ] **Step 7.3: Run the full Playwright suite**

```bash
PATH="$HOME/.bun/bin:$PATH" timeout 300 ~/.bun/bin/bunx playwright test --reporter=line --workers=2 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 7.4: Push the branch**

```bash
git push -u origin promote-connect-affordance 2>&1 | tail -5
```

- [ ] **Step 7.5: Open the PR**

```bash
gh pr create --title "Promote Connect affordance to /playground page level" --body "$(cat <<'EOF'
## Summary
- New `<ConnectBar>` island next to the Playground h1 — shows a primary "Connect" button when no session, or the existing ProviderStatus chip when connected.
- Single ConnectSheet per page (owned by ConnectBar). Chat and JDAnalyzer drop their internal sheets.
- Cross-island session state via two new CustomEvents in `session.ts`:
  - `cv:session-changed` — dispatched from `writeSession`/`clearSession`; subscribed by ConnectBar, Chat, JDAnalyzer
  - `cv:request-connect` — dispatched by Chat/JDAnalyzer when a user tries to interact without a session; ConnectBar listens and opens its sheet (one-click flow)
- Trims the redundant "Connect with your own AI account..." clause from the intro paragraph.

## Spec & plan
- Spec: [`docs/superpowers/specs/2026-05-21-promote-connect-affordance-design.md`](docs/superpowers/specs/2026-05-21-promote-connect-affordance-design.md)
- Plan: [`docs/superpowers/plans/2026-05-21-promote-connect-affordance.md`](docs/superpowers/plans/2026-05-21-promote-connect-affordance.md)

## Test plan
- [x] `bun run build` clean
- [x] `bun run test` — all unit + integration green (+7 new tests: 2 session-event + 5 ConnectBar)
- [x] `bunx playwright test` — all E2E green (+2 new tests: button + cv:request-connect flow)
- [ ] CI `build-and-test` passes
- [ ] After deploy, visit `/playground/`, accept T&C — confirm Connect button next to "Playground" title
- [ ] Click Connect, pick a provider, paste a key — confirm chip replaces button at page level
- [ ] Click Disconnect — confirm button reappears
- [ ] Try sending a chat message without a session — confirm ConnectSheet opens via the page-level bar

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the returned PR URL and number.

- [ ] **Step 7.6: Enable squash auto-merge**

```bash
PR=$(gh pr view --json number --jq '.number')
gh pr merge $PR --auto --squash --repo CAM-eEng/CV
```

- [ ] **Step 7.7: Report PR state — do NOT wait for merge**

```bash
gh pr view $PR --repo CAM-eEng/CV --json number,url,state,mergeStateStatus,autoMergeRequest --jq '"PR #\(.number): \(.url)\nstate: \(.state)\nmerge: \(.mergeStateStatus)\nauto: \(.autoMergeRequest.mergeMethod // "off")"'
```

- [ ] **Step 7.8: Skip local cleanup**

DO NOT run local cleanup commands. The controller will handle cleanup (switch to main, pull, delete local + remote branches) after merge fires.

---

## Notes for the implementer

- **`bun` path:** `~/.bun/bin/bun`, not in `$PATH` by default. Either invoke with full path or `export PATH="$HOME/.bun/bin:$PATH"`.
- **Branch protection on main:** requires PRs, requires CI green, requires linear history. Auto-merge with squash handles all three. If CI fails on a push, fix the issue and push a new commit — don't force-push or admin-override.
- **Intermediate commits (Tasks 3, 4, 5) leave the page in a state where two ConnectSheets exist on the page momentarily.** Both work; only ConnectBar's is triggered by visible UI. The PR squash-merges to a single commit on main, so this state never reaches production. CI runs on each push but is fine with the intermediate.
- **Prior session-storage tests use `sessionStorage.clear()` in `beforeEach`.** Match that pattern when adding new tests.
- **Existing React test pattern reference:** `tests/unit/key-paste-form.test.tsx` shows the import + render + cleanup pattern using `@testing-library/react` + `vitest`.
- **The codebase uses Prettier with `printWidth: 100`.** Long JSX class strings get wrapped. Run `~/.bun/bin/bun run lint` after edits and fix any complaints with `bunx prettier --write <file>`.
- **PR may land BEHIND main** if other PRs merge between push and auto-merge. The standard remedy (per the prior demo-removal PR playbook): `git fetch origin main && git merge origin/main --no-edit && git push` — auto-merge will re-evaluate.
