import type { APIRoute } from 'astro';
import { loadCV } from '~/lib/content/cv-loader';
import { resolve } from 'node:path';

export const GET: APIRoute = async () => {
  const cv = await loadCV(resolve(process.cwd(), 'content/cv.yaml'));
  return new Response(JSON.stringify(cv, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
