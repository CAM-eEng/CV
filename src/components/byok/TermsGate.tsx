import { useState, useEffect } from 'react';
import { hasAcceptedTerms, acceptTerms } from '~/lib/ai/terms';

export function TermsGate() {
  const [open, setOpen] = useState<boolean>(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    setOpen(!hasAcceptedTerms());
    if (!hasAcceptedTerms()) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!open) return null;

  function accept() {
    acceptTerms();
    document.body.style.overflow = '';
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-lg p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 id="terms-title" className="text-xl font-semibold mb-3">
          Terms &amp; Conditions
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none mb-4 max-h-[50vh] overflow-y-auto">
          <p>
            Before using the AI features on this page (chat, JD analyzer, and any future AI tools),
            please read and accept the following:
          </p>
          <ol>
            <li>
              <strong>No harm.</strong> This tool is not to be used in any way that causes
              financial, emotional, physical, or any other harm to any person or entity. You are
              solely responsible for your use of the tool and any consequences.
            </li>
            <li>
              <strong>You bring the key.</strong> Inference is performed by your connected provider
              (OpenRouter, Anthropic, OpenAI, or local demo mode). This site does not proxy, log, or
              store your queries, responses, or API credentials. Costs are billed to you by your
              provider.
            </li>
            <li>
              <strong>No warranty.</strong> AI-generated content may be inaccurate, incomplete, or
              wrong. Do not rely on it for any decision that has real-world consequences without
              independent verification.
            </li>
            <li>
              <strong>Provider responsibility.</strong> AI providers you connect with may produce
              inaccurate, biased, or harmful content. Outputs reflect the model and provider you
              choose, not Cameron's views. Cameron is not responsible for content generated through
              your connected provider.
            </li>
            <li>
              <strong>Session-only memory.</strong> Your acceptance and any credentials live only in
              your browser&rsquo;s <code>sessionStorage</code> and disappear when you close the tab.
            </li>
          </ol>
        </div>
        <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>I have read and agree to these terms and conditions.</span>
        </label>
        <button
          onClick={accept}
          disabled={!agreed}
          className="w-full px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Agree to Terms and Conditions
        </button>
      </div>
    </div>
  );
}
