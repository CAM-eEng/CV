import type { APIRoute } from 'astro';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
  const projects = await getCollection('projects');

  const lines = [
    `# ${cv.basics.name}`,
    '',
    `> ${cv.basics.label}. ${cv.basics.summary.split('\n')[0]}`,
    '',
    '## Canonical machine-readable CV',
    '- [/cv.json](https://cameronhartman.dev/cv.json) — JSON Resume schema',
    '- [/cv](https://cameronhartman.dev/cv) — human-readable HTML CV with JSON-LD',
    '',
    '## Work',
    ...cv.work.map(
      (w) =>
        `- ${w.position} at ${w.name} (${w.startDate}${w.endDate ? '–' + w.endDate : '–present'})`,
    ),
    '',
    '## Skills (top categories)',
    ...cv.skills.map((s) => `- ${s.name}: ${s.keywords.join(', ')}`),
    '',
    '## Projects',
    ...projects.map(
      (p) =>
        `- [${p.data.title}](https://cameronhartman.dev/projects/${p.data.slug}) — ${p.data.summary}`,
    ),
    '',
    '## Contact',
    `- email: ${cv.basics.email}`,
    ...cv.basics.profiles.map((p) => `- ${p.network.toLowerCase()}: ${p.url}`),
    '',
  ].join('\n');

  return new Response(lines, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
