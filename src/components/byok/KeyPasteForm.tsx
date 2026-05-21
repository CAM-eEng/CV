import { useRef, useState } from 'react';
import { writeSession } from '~/lib/ai/session';
import type { ProviderId } from '~/lib/ai/provider';

interface Props {
  providerId: 'anthropic' | 'openai';
  defaultModel: string;
  onConnected: () => void;
}

export function KeyPasteForm({ providerId, defaultModel, onConnected }: Props) {
  // Uncontrolled input — the key never lives in React state.
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const placeholder = providerId === 'anthropic' ? 'sk-ant-…' : 'sk-…';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'cameronhartman.dev';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = inputRef.current?.value ?? '';
        if (!value) return;
        setSubmitting(true);
        try {
          writeSession({
            providerId: providerId as ProviderId,
            token: value.trim(),
            model: defaultModel,
          });
          if (inputRef.current) inputRef.current.value = '';
          onConnected();
        } catch (e) {
          setErr(e instanceof Error ? e.message : String(e));
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-3"
    >
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        <span aria-hidden>🔒</span> You are pasting into{' '}
        <code className="font-mono">{hostname}</code>. Verify the address bar before submitting.
      </div>
      <label className="block text-sm">
        <span className="text-neutral-500">API key</span>
        <input
          ref={inputRef}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          defaultValue=""
          className="mt-1 w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent font-mono text-sm"
        />
      </label>
      <p className="text-xs text-neutral-500">
        Key stored in <code>sessionStorage</code> only — vanishes when you close the tab. Browser
        extensions and compromised tabs can still read it. If you don't trust this session, don't paste a key.
      </p>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 disabled:opacity-50"
      >
        {submitting ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  );
}
