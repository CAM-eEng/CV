import type { Activity } from '~/lib/activity/schema';
import type { CV } from '~/lib/content/cv-schema';
import { ContributionHeatmap } from './ContributionHeatmap';
import { LanguagesDonut } from './LanguagesDonut';
import { FreshnessTimeline } from './FreshnessTimeline';
import { HtbStatsCard } from './HtbStatsCard';
import { FeaturedRepoCarousel, filterFeaturedRepos } from './FeaturedRepoCarousel';

interface Props {
  activity: Activity;
  cv: CV;
}

export function ActivityDashboard({ activity, cv }: Props) {
  const empty =
    activity.contributions.days.length === 0 &&
    activity.languages.length === 0 &&
    activity.repos.length === 0;

  if (empty) {
    return (
      <p className="text-sm text-neutral-500 italic">
        Activity dashboard pending first nightly refresh.
      </p>
    );
  }

  const generatedAgo = new Date(activity.generatedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500">Recent activity</h2>
        <span className="text-xs text-neutral-500 font-mono">refreshed {generatedAgo}</span>
      </header>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
          GitHub contributions · last year ({activity.contributions.totalLastYear})
        </h3>
        <ContributionHeatmap days={activity.contributions.days} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Top languages</h3>
          <LanguagesDonut languages={activity.languages} />
        </div>
        <HtbStatsCard htb={activity.htb} />
      </section>

      {activity.freshness.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Tech freshness</h3>
          <FreshnessTimeline freshness={activity.freshness} />
        </section>
      )}

      {filterFeaturedRepos(activity.repos, cv.projects).length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
            Featured projects
          </h3>
          <FeaturedRepoCarousel repos={activity.repos} projects={cv.projects} />
        </section>
      )}
    </div>
  );
}
