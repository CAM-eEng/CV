import { z } from 'zod';

export const JDFitSchema = z.object({
  fit_score: z.number().int().min(0).max(100),
  matched_skills: z
    .array(
      z.object({
        skill: z.string().min(1),
        evidence: z.string().min(1),
      }),
    )
    .min(1),
  gaps: z.array(z.string()),
  tailored_intro: z.string().min(1),
  suggested_questions: z.array(z.string()).min(1),
});

export type JDFit = z.infer<typeof JDFitSchema>;

export function buildJDPrompt(jobDescription: string): string {
  return `A visitor pasted this job description. Compare it against Cameron's CV (in the system prompt) and produce a structured fit assessment. \
Use citation keys (work.N.highlights.N or skills.N) for the evidence field. \
The intro paragraph should be addressable to a hiring manager and should not invent any details not present in the CV.

Job description:
"""
${jobDescription}
"""

Respond with ONLY a JSON object matching this shape:
{
  "fit_score": integer 0-100,
  "matched_skills": [{"skill": "...", "evidence": "work.0.highlights.1"}, ...],
  "gaps": ["..."],
  "tailored_intro": "...",
  "suggested_questions": ["..."]
}`;
}
