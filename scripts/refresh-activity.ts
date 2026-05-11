// scripts/refresh-activity.ts
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ActivitySchema } from '~/lib/activity/schema';
import { fetchGithubActivity } from '~/lib/activity/github';
import { fetchHtbStats } from '~/lib/activity/htb';
import { loadHtbManual } from '~/lib/activity/htb-manual';
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

  // HTB stats: prefer live API if token configured, fall back to a
  // hand-maintained data/htb-manual.json, finally fall back to null.
  // HTB_USER_ID is optional — fetchHtbStats derives it from the JWT's
  // `sub` claim when not provided.
  let htb = null;
  if (process.env.HTB_API_TOKEN) {
    try {
      console.log('Fetching HackTheBox stats from API…');
      htb = await fetchHtbStats({
        token: process.env.HTB_API_TOKEN,
        userId: process.env.HTB_USER_ID,
      });
    } catch (e) {
      console.error(
        'HTB API fetch failed, will try manual fallback:',
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  if (!htb) {
    const manualPath = resolve(process.cwd(), 'data/htb-manual.json');
    htb = await loadHtbManual(manualPath);
    if (htb) {
      console.log(`Loaded HTB stats from ${manualPath}.`);
    } else {
      console.log('No HTB stats available (no API token, no manual file); htb=null.');
    }
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
