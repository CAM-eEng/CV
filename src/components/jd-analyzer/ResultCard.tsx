import type { JDFit } from '~/lib/ai/jd-schema';
import { ScoreGauge } from './ScoreGauge';
import { rewriteCitations } from '~/lib/ai/citations';
import { SafeMarkdown } from '~/lib/markdown/safe';

export function ResultCard({ fit }: { fit: JDFit }) {
  return (
    <div className="space-y-6 border border-neutral-200 dark:border-neutral-800 rounded p-6">
      <header className="flex items-center gap-6">
        <ScoreGauge score={fit.fit_score} />
        <div>
          <h3 className="font-medium">Fit score</h3>
          <p className="text-sm text-neutral-500">Higher means closer alignment with the JD.</p>
        </div>
      </header>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Matched skills</h4>
        <ul className="space-y-1">
          {fit.matched_skills.map((m, i) => (
            <li key={i} className="text-sm">
              <strong>{m.skill}</strong>{' '}
              <span className="text-neutral-500">— {rewriteCitations(`[${m.evidence}]`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {fit.gaps.length > 0 && (
        <section>
          <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Gaps</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {fit.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Tailored intro</h4>
        <SafeMarkdown content={rewriteCitations(fit.tailored_intro)} />
        <button
          onClick={() => navigator.clipboard.writeText(fit.tailored_intro)}
          className="mt-2 text-xs underline underline-offset-4"
        >
          Copy
        </button>
      </section>

      <section>
        <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
          Suggested interview questions
        </h4>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          {fit.suggested_questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
