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
          writeSession({
            providerId: providerId as ProviderId,
            token: key.trim(),
            model: defaultModel,
          });
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
        Key stored in <code>sessionStorage</code> only — vanishes when you close the tab. Browser
        extensions and compromised tabs can still read it. Use demo mode if you don't trust this
        session.
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
