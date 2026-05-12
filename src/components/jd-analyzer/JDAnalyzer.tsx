import { useState } from 'react';
import { ResultCard } from './ResultCard';
import { ConnectSheet } from '~/components/byok/ConnectSheet';
import { getActiveProvider } from '~/lib/ai/registry';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import { readSession } from '~/lib/ai/session';
import { JDFitSchema, type JDFit, buildJDPromptBody } from '~/lib/ai/jd-schema';
import type { CV } from '~/lib/content/cv-schema';

export function JDAnalyzer({ cv }: { cv: CV }) {
  const [jd, setJd] = useState('');
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState<JDFit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const systemPrompt = buildSystemPrompt(cv);

  async function analyze() {
    if (!jd.trim()) return;
    if (!readSession()) {
      setSheetOpen(true);
      return;
    }
    setBusy(true);
    setErr(null);
    setFit(null);
    try {
      const provider = getActiveProvider(systemPrompt);
      const result = await provider.structured({ prompt: buildJDPromptBody(jd, cv.basics.summary), schema: JDFitSchema });
      setFit(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="Paste a job description here…"
        rows={6}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent text-sm resize-y"
      />
      <button
        onClick={analyze}
        disabled={busy || !jd.trim()}
        className="px-4 py-2 rounded bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm disabled:opacity-50"
      >
        {busy ? 'Analyzing…' : 'Analyze fit'}
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {fit && <ResultCard fit={fit} />}
      <ConnectSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConnected={() => {
          setSheetOpen(false);
          analyze();
        }}
      />
    </div>
  );
}
