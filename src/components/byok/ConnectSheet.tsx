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
          <button onClick={onClose} aria-label="Close" className="text-neutral-500">
            ✕
          </button>
        </div>

        {mode === 'menu' && (
          <div className="space-y-2">
            <button
              onClick={startOpenRouter}
              className="w-full text-left px-4 py-3 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Connect OpenRouter</div>
              <div className="text-xs text-neutral-500">
                OAuth — many models, free options. Recommended.
              </div>
            </button>
            <button
              onClick={() => setMode('anthropic')}
              className="w-full text-left px-4 py-3 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Use an Anthropic key</div>
              <div className="text-xs text-neutral-500">
                Paste your own. Most direct path; key stays in your browser.
              </div>
            </button>
            <button
              onClick={() => setMode('openai')}
              className="w-full text-left px-4 py-3 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Use an OpenAI key</div>
              <div className="text-xs text-neutral-500">
                Paste your own. Key stays in your browser.
              </div>
            </button>
            <button
              onClick={startDemo}
              className="w-full text-left px-4 py-3 rounded border border-dashed border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div className="font-medium">Try demo mode</div>
              <div className="text-xs text-neutral-500">
                No key, no calls — pre-baked answers about Cameron.
              </div>
            </button>
          </div>
        )}

        {mode === 'anthropic' && (
          <>
            <button onClick={() => setMode('menu')} className="text-xs text-neutral-500">
              ← back
            </button>
            <KeyPasteForm
              providerId="anthropic"
              defaultModel="claude-opus-4-7"
              onConnected={onConnected}
            />
          </>
        )}

        {mode === 'openai' && (
          <>
            <button onClick={() => setMode('menu')} className="text-xs text-neutral-500">
              ← back
            </button>
            <KeyPasteForm providerId="openai" defaultModel="gpt-4o" onConnected={onConnected} />
          </>
        )}
      </div>
    </div>
  );
}
