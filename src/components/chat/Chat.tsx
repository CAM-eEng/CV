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
