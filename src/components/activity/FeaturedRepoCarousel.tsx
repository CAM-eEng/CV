import type { Activity } from '~/lib/activity/schema';
import type { CV } from '~/lib/content/cv-schema';

interface Props {
  repos: Activity['repos'];
  projects: CV['projects'];
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 730) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function filterFeaturedRepos(
  repos: Activity['repos'],
  projects: CV['projects'],
): Activity['repos'] {
  const names = new Set(projects.filter((p) => p.featured).map((p) => p.name.toLowerCase()));
  return repos.filter((r) => names.has(r.name.toLowerCase()));
}

export function FeaturedRepoCarousel({ repos, projects }: Props) {
  const cards = filterFeaturedRepos(repos, projects);
  if (!cards.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((r) => (
        <a
          key={r.name}
          href={r.url}
          className="block border border-neutral-200 dark:border-neutral-800 rounded p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
        >
          <div className="flex items-baseline justify-between mb-1">
            <h5 className="font-mono font-medium">{r.name}</h5>
            <span className="text-xs text-neutral-500">{relativeDate(r.lastPushedAt)}</span>
          </div>
          {r.description && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2 line-clamp-2">
              {r.description}
            </p>
          )}
          <div className="flex gap-4 text-xs text-neutral-500 font-mono">
            <span>★ {r.stars}</span>
            <span>⑂ {r.forks}</span>
            {r.primaryLanguage && <span>{r.primaryLanguage}</span>}
          </div>
        </a>
      ))}
    </div>
  );
}
