import type { SkillsFile } from '~/lib/content/skills-schema';

interface RepoMinimal {
  primaryLanguage: string | null;
  lastPushedAt: string;
}

interface FreshnessEntry {
  name: string;
  category: string;
  lastUsed: string; // YYYY-MM
  source: 'skills.yaml' | 'github';
}

function isoToYearMonth(iso: string): string {
  return iso.slice(0, 7);
}

function compareYearMonth(a: string, b: string): number {
  return a.localeCompare(b);
}

export function mergeFreshness(skills: SkillsFile, repos: RepoMinimal[]): FreshnessEntry[] {
  const ghByLang = new Map<string, string>();
  for (const r of repos) {
    if (!r.primaryLanguage) continue;
    const lang = r.primaryLanguage.toLowerCase();
    const ym = isoToYearMonth(r.lastPushedAt);
    const prev = ghByLang.get(lang);
    if (!prev || compareYearMonth(ym, prev) > 0) ghByLang.set(lang, ym);
  }

  const out: FreshnessEntry[] = [];
  for (const cat of skills.categories) {
    for (const s of cat.skills) {
      const yamlMonth = s.last_used.length === 4 ? `${s.last_used}-01` : s.last_used;
      const ghMonth = ghByLang.get(s.name.toLowerCase());
      const useGh = ghMonth && compareYearMonth(ghMonth, yamlMonth) > 0;
      out.push({
        name: s.name,
        category: cat.name,
        lastUsed: useGh ? ghMonth! : yamlMonth,
        source: useGh ? 'github' : 'skills.yaml',
      });
    }
  }
  return out;
}
