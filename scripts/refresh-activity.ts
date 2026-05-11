// scripts/refresh-activity.ts
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ActivitySchema } from '~/lib/activity/schema';
import { fetchGithubActivity } from '~/lib/activity/github';
import { fetchHtbStats } from '~/lib/activity/htb';
import { mergeFreshness } from '~/lib/activity/freshness';
import { loadSkills } from '~/lib/content/skills-loader';

const REQUIRED_ENV = ['GH_API_TOKEN', 'GH_LOGIN'] as const;

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  for (const k of REQUIRED_ENV) readEnv(k);

  const ghLogin = readEnv('GH_LOGIN');
  const ghToken = readEnv('GH_API_TOKEN');

  console.log(`Fetching GitHub activity for ${ghLogin}…`);
  const gh = await fetchGithubActivity({ token: ghToken, login: ghLogin });

  let htb = null;
  if (process.env.HTB_API_TOKEN && process.env.HTB_USER_ID) {
    try {
      console.log('Fetching HackTheBox stats…');
      htb = await fetchHtbStats({
        token: process.env.HTB_API_TOKEN,
        userId: process.env.HTB_USER_ID,
      });
    } catch (e) {
      console.error(
        'HTB fetch failed, continuing with htb=null:',
        e instanceof Error ? e.message : String(e),
      );
    }
  } else {
    console.log('HTB env not configured; skipping.');
  }

  const skills = await loadSkills(resolve(process.cwd(), 'content/skills.yaml'));
  const freshness = mergeFreshness(skills, gh.repos);

  const activity = {
    generatedAt: new Date().toISOString(),
    contributions: gh.contributions,
    languages: gh.languages,
    repos: gh.repos,
    htb,
    freshness,
  };

  // Validate before writing — fail loud if our own shape drifted.
  ActivitySchema.parse(activity);

  const outPath = resolve(process.cwd(), 'data/activity.json');
  await writeFile(outPath, JSON.stringify(activity, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
