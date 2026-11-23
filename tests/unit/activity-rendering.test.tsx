import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ActivityDashboard } from '~/components/activity/ActivityDashboard';
import { safeRepoHref } from '~/components/activity/FeaturedRepoCarousel';
import type { Activity } from '~/lib/activity/schema';
import type { CV } from '~/lib/content/cv-schema';

afterEach(() => {
  cleanup();
});

const XSS = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';

// Hostile values in every rendered string field. Deliberately bypasses the
// schema (cast) to prove the renderer is safe on its own.
function hostileActivity(url: string): Activity {
  return {
    generatedAt: '2026-05-11T03:00:00Z',
    contributions: { days: [{ date: '2026-05-10', count: 3 }], totalLastYear: 3 },
    languages: [{ name: XSS, bytes: 10 }],
    repos: [
      {
        name: 'evil',
        description: XSS,
        url,
        stars: 1,
        forks: 0,
        lastPushedAt: '2026-05-01T00:00:00Z',
        primaryLanguage: XSS,
      },
    ],
    htb: { rank: XSS, points: 1, ownedMachines: 1, categories: { [XSS]: 1 } },
    freshness: [{ name: XSS, category: XSS, lastUsed: '2026-05', source: 'github' }],
  } as Activity;
}

const cv = { projects: [{ name: 'evil', featured: true }] } as unknown as CV;

describe('activity rendering', () => {
  it('renders hostile strings as text, never as markup', () => {
    const { container } = render(
      <ActivityDashboard activity={hostileActivity('https://github.com/a/evil')} cv={cv} />,
    );
    expect(container.querySelector('img, script, iframe, object')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    // Rendered literally, in every place that shows a string field.
    const literal = [...container.querySelectorAll('*')].filter((el) => el.textContent === XSS);
    expect(literal.length).toBeGreaterThanOrEqual(6);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://github.com/a/evil',
    'https://github.com.evil.example/a/evil',
    'https://user:pw@github.com/a/evil',
    'not a url',
  ])('does not put unsafe repo url %s into an href', (url) => {
    const { container } = render(<ActivityDashboard activity={hostileActivity(url)} cv={cv} />);
    const card = container.querySelector('a');
    expect(card, 'featured card still renders').not.toBeNull();
    expect(card!.hasAttribute('href')).toBe(false);
  });

  it('keeps a normal GitHub repo link', () => {
    const { container } = render(
      <ActivityDashboard activity={hostileActivity('https://github.com/a/evil')} cv={cv} />,
    );
    expect(container.querySelector('a')!.getAttribute('href')).toBe('https://github.com/a/evil');
    expect(safeRepoHref('https://github.com/CAM-eEng/CV')).toBe('https://github.com/CAM-eEng/CV');
  });

  it('no activity component uses a raw-HTML sink', async () => {
    const dir = resolve(__dirname, '../../src/components/activity');
    for (const file of await readdir(dir)) {
      const src = await readFile(resolve(dir, file), 'utf8');
      expect(src, file).not.toMatch(/dangerouslySetInnerHTML|innerHTML|set:html/);
    }
  });
});
