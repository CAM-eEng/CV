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
    session.providerId === 'anthropic'
      ? 'Anthropic'
      : session.providerId === 'openai'
        ? 'OpenAI'
        : 'OpenRouter';

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
      <span>Connected · {label}</span>
      <button
        onClick={() => {
          clearSession();
          setSession(null);
          onChange();
        }}
        className="ml-2 underline underline-offset-4 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        Disconnect
      </button>
    </div>
  );
}
