const GRAPHQL_URL = 'https://api.github.com/graphql';
const REST_BASE = 'https://api.github.com';

interface ContributionDay {
  date: string;
  count: number;
}
interface Language {
  name: string;
  bytes: number;
}
interface Repo {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  lastPushedAt: string;
  primaryLanguage: string | null;
}

interface GithubActivity {
  contributions: { days: ContributionDay[]; totalLastYear: number };
  languages: Language[];
  repos: Repo[];
}

interface GhCalendarWeek {
  contributionDays: Array<{ date: string; contributionCount: number }>;
}

interface GhContributionsResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions?: number;
          weeks?: GhCalendarWeek[];
        };
      };
    };
  };
  message?: string;
  errors?: Array<{ message: string }>;
}

interface GhRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  language: string | null;
  fork: boolean;
  archived: boolean;
}

async function ghFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json, application/json',
      'x-github-api-version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
}

async function fetchContributions(
  token: string,
  login: string,
): Promise<GithubActivity['contributions']> {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
  `;
  const res = await ghFetch(GRAPHQL_URL, token, {
    method: 'POST',
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as GhContributionsResponse;
  if (json.errors?.length)
    throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  const cal = json.data?.user?.contributionsCollection?.contributionCalendar;
  const days: ContributionDay[] = [];
  for (const week of cal?.weeks ?? []) {
    for (const day of week.contributionDays) {
      days.push({ date: day.date, count: day.contributionCount });
    }
  }
  return { days, totalLastYear: cal?.totalContributions ?? 0 };
}

async function fetchRepos(token: string, login: string): Promise<Repo[]> {
  const res = await ghFetch(
    `${REST_BASE}/users/${login}/repos?per_page=100&sort=pushed&type=public`,
    token,
  );
  if (!res.ok) throw new Error(`GitHub repos error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as GhRepo[];
  return json
    .filter((r) => !r.fork && !r.archived)
    .map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      stars: r.stargazers_count,
      forks: r.forks_count,
      lastPushedAt: r.pushed_at,
      primaryLanguage: r.language,
    }));
}

async function fetchLanguages(token: string, login: string, repos: Repo[]): Promise<Language[]> {
  const byLang = new Map<string, number>();
  // Cap at 30 repos for rate-limit hygiene.
  for (const r of repos.slice(0, 30)) {
    const res = await ghFetch(`${REST_BASE}/repos/${login}/${r.name}/languages`, token);
    if (!res.ok) continue;
    const json = (await res.json()) as Record<string, number>;
    for (const [name, bytes] of Object.entries(json)) {
      byLang.set(name, (byLang.get(name) ?? 0) + bytes);
    }
  }
  return [...byLang.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

export async function fetchGithubActivity(opts: {
  token: string;
  login: string;
}): Promise<GithubActivity> {
  const contributions = await fetchContributions(opts.token, opts.login);
  const repos = await fetchRepos(opts.token, opts.login);
  const languages = await fetchLanguages(opts.token, opts.login, repos);
  return { contributions, languages, repos };
}
