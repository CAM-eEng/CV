import { describe, it, expect } from 'vitest';
import { JDFitSchema } from '~/lib/ai/jd-schema';

describe('JDFitSchema', () => {
  const valid = {
    fit_score: 78,
    matched_skills: [{ skill: 'Python', evidence: 'work.0.highlights.1' }],
    gaps: ['No K8s production experience'],
    tailored_intro: 'A short paragraph.',
    suggested_questions: ['What did the Regression AI Agent architecture look like?'],
  };

  it('accepts the canonical shape', () => {
    expect(() => JDFitSchema.parse(valid)).not.toThrow();
  });

  it('rejects fit_score out of [0, 100]', () => {
    expect(() => JDFitSchema.parse({ ...valid, fit_score: 101 })).toThrow();
    expect(() => JDFitSchema.parse({ ...valid, fit_score: -1 })).toThrow();
    expect(() => JDFitSchema.parse({ ...valid, fit_score: 50.5 })).toThrow();
  });

  it('requires at least one matched_skill', () => {
    expect(() => JDFitSchema.parse({ ...valid, matched_skills: [] })).toThrow();
  });

  it('allows empty gaps array', () => {
    expect(() => JDFitSchema.parse({ ...valid, gaps: [] })).not.toThrow();
  });
});
