import { useEffect, useState } from 'react';
import { ResultCard } from './ResultCard';
import { ConnectSheet } from '~/components/byok/ConnectSheet';
import { getActiveProvider } from '~/lib/ai/registry';
import { buildSystemPrompt } from '~/lib/ai/system-prompt';
import { readSession } from '~/lib/ai/session';
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [accepted, setAccepted] = useState<boolean>(false);

  useEffect(() => {
    const refresh = () => setAccepted(hasAcceptedTerms());
    refresh();
    window.addEventListener(TERMS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TERMS_CHANGED_EVENT, refresh);
  }, []);

  const systemPrompt = buildSystemPrompt(cv);

  async function analyze() {
    if (!jd.trim()) return;
    if (!readSession()) {
      setSheetOpen(true);
      return;
    }
    if (jdLimitReached()) {
      setErr(
        `Session limit reached (${MAX_JD_ANALYSES_PER_SESSION} analyses). Refresh the page to reset.`,
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
      // Apply moderation to user-visible string fields.
      const moderated: JDFit = {
        ...result,
        tailored_intro: filter(result.tailored_intro).sanitized,
        gaps: result.gaps.map((g) => filter(g).sanitized),
        suggested_questions: result.suggested_questions.map((q) => filter(q).sanitized),
        matched_skills: result.matched_skills.map((m) => ({
          skill: filter(m.skill).sanitized,
          evidence: m.evidence, // evidence is a citation key, safe by schema
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
      {fit && (
        <>
          {readSession()?.providerId === 'demo' && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Demo mode:</strong> this is a sample analysis. The demo provider returns the
              same response regardless of the pasted job description. Connect a real provider
              (OpenRouter, Anthropic, OpenAI) for an analysis that actually reads your JD.
            </p>
          )}
          <ResultCard fit={fit} />
        </>
      )}
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
