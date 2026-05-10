import type { CV } from '~/lib/content/cv-schema';

export function personJsonLd(cv: CV) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: cv.basics.name,
    jobTitle: cv.basics.label,
    email: `mailto:${cv.basics.email}`,
    url: cv.basics.url,
    description: cv.basics.summary,
    address: {
      '@type': 'PostalAddress',
      addressLocality: cv.basics.location.city,
      addressRegion: cv.basics.location.region,
      addressCountry: cv.basics.location.countryCode,
    },
    sameAs: cv.basics.profiles.map((p) => p.url),
  } as const;
}
