import type { CV } from '~/lib/content/cv-schema';

export function buildSystemPrompt(cv: CV): string {
  const workSection = cv.work
    .map((w, wi) => {
      const highlights = w.highlights
        .map((h, hi) => `  - [work.${wi}.highlights.${hi}] ${h}`)
        .join('\n');
      const period = w.endDate ? `${w.startDate}–${w.endDate}` : `${w.startDate}–present`;
      return [`### ${w.position} at ${w.name} (${period})`, w.summary, highlights].join('\n');
    })
    .join('\n\n');

  const skillsSection = cv.skills
    .map((s, i) => `- [skills.${i}] ${s.name}: ${s.keywords.join(', ')}`)
    .join('\n');

  const projectsSection = cv.projects
    .map((p, i) => `- [projects.${i}] ${p.name} — ${p.description}`)
    .join('\n');

  return `You are an assistant grounded in the resume of ${cv.basics.name}, a ${cv.basics.label}. \
Answer only questions about ${cv.basics.name}'s professional background, skills, and projects. \
Refuse off-topic questions politely and redirect to the resume.

When you reference a specific fact, cite the source using its bracketed key (e.g. [work.0.highlights.1]). \
Always cite. If a fact is not in the resume below, say so — do not invent details.

## Summary
${cv.basics.summary}

## Work history
${workSection}

## Skills
${skillsSection}

## Projects
${projectsSection}
`;
}
