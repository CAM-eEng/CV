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
      for await (const chunk of provider.chat({
        messages: next,
        signal: abortRef.current.signal,
      })) {
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
        onConnected={() => {
          setSheetOpen(false);
          setConnectedTick((t) => t + 1);
        }}
      />
    </div>
  );
}
