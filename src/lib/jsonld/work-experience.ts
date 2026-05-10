import type { CV } from '~/lib/content/cv-schema';

export function workExperienceJsonLd(cv: CV) {
  return cv.work.map((w) => ({
    '@context': 'https://schema.org',
    '@type': 'WorkRole',
    roleName: w.position,
    startDate: w.startDate,
    ...(w.endDate ? { endDate: w.endDate } : {}),
    description: w.summary,
    worksFor: {
      '@type': 'Organization',
      name: w.name,
      ...(w.url ? { url: w.url } : {}),
    },
  }));
}
