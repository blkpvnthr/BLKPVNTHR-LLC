/**
 * BLKPVNTHR LLC — site model consumed by scripts/build.mjs.
 *
 * SITE  — global config: canonical origin, nav model, footer model, OG defaults.
 * PAGES — one descriptor per output route. `body` names a fragment in
 *         src/pages/; `out` is the path written under site/; `canonicalPath` is
 *         the public URL path (null => no canonical / not in sitemap, e.g. 404).
 *
 * Content accuracy is load-bearing here (the validator enforces it): every
 * public claim is either verifiable from public record or framed as a proposed
 * research objective. No NSF funding/endorsement, patents, certifications,
 * partnerships, customers, or awards are asserted.
 */

export const SITE = {
  origin: 'https://blkpvnthr.com',
  name: 'BLKPVNTHR LLC',
  year: '2026',
  lastmod: '2026-11-25',
  ogImage: '/assets/og-card.png',
  ogImageAlt: 'BLKPVNTHR LLC — Decision intelligence for systems that matter.',

  // Primary navigation. Labels kept compact so the row fits before the mobile
  // breakpoint; full names live in the page titles/headings (e.g. nav "Research"
  // -> page "Research & Development").
  nav: [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'research', label: 'Research', href: '/research' },
    { key: 'technologies', label: 'Technologies', href: '/technologies' },
    { key: 'applications', label: 'Applications', href: '/applications' },
    { key: 'commercialization', label: 'Commercialization', href: '/commercialization' },
    { key: 'company', label: 'Company', href: '/company' },
    { key: 'contact', label: 'Contact', href: '/contact' }
  ],
  navCta: { label: 'Discuss an opportunity', href: '/contact' },

  footer: {
    columns: [
      {
        title: 'Research',
        links: [
          { label: 'Research & Development', href: '/research' },
          { label: 'STRIX', href: '/research/strix' },
          { label: 'Research library', href: '/publications' }
        ]
      },
      {
        title: 'Technology',
        links: [
          { label: 'Technology portfolio', href: '/technologies' },
          { label: 'Applications', href: '/applications' },
          { label: 'Commercialization', href: '/commercialization' }
        ]
      },
      {
        title: 'Company',
        links: [
          { label: 'Company', href: '/company' },
          { label: 'Partnerships', href: '/partnerships' },
          { label: 'Contact', href: '/contact' }
        ]
      },
      {
        title: 'Legal',
        links: [
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' }
        ]
      }
    ]
  }
};

// Organization structured data for the homepage. Every field is verifiable from
// public record (Maryland SDAT) or the company's own operations — no awards,
// ratings, customers, funding, or affiliations.
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BLKPVNTHR LLC',
  legalName: 'BLKPVNTHR LLC',
  alternateName: 'BLKPVNTHR',
  url: 'https://blkpvnthr.com/',
  logo: 'https://blkpvnthr.com/assets/blkpvnthr-mark.png',
  image: 'https://blkpvnthr.com/assets/og-card.png',
  description:
    'BLKPVNTHR LLC develops evidence-grounded artificial intelligence, analytical engines, and computational research infrastructure for reliable, traceable, and defensible decisions in complex institutional environments.',
  slogan: 'Decision intelligence for systems that matter.',
  foundingDate: '2026-02-07',
  email: 'contact@blkpvnthr.com',
  address: { '@type': 'PostalAddress', addressRegion: 'MD', addressCountry: 'US' },
  founder: { '@type': 'Person', name: 'Asmaa Abdul-Amin' },
  knowsAbout: [
    'Evidence-grounded artificial intelligence',
    'Independent computational verification',
    'Information provenance and traceability',
    'Temporal knowledge systems',
    'Analytical engines and scenario modeling',
    'Reproducible computational research'
  ],
  sameAs: ['https://github.com/blkpvnthr'],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'business inquiries',
    email: 'contact@blkpvnthr.com',
    areaServed: 'US',
    availableLanguage: 'English'
  }
};

export const PAGES = [
  {
    out: 'index.html',
    canonicalPath: '/',
    active: 'home',
    layout: 'default',
    body: 'index.html',
    title: 'BLKPVNTHR LLC — Decision intelligence for systems that matter.',
    description:
      'BLKPVNTHR LLC builds evidence-grounded AI, analytical engines, and computational research infrastructure for traceable, defensible institutional decisions.',
    ogType: 'website',
    jsonld: ORG_JSONLD,
    sitemap: { changefreq: 'monthly', priority: 1.0 }
  },
  {
    out: 'research.html',
    canonicalPath: '/research',
    active: 'research',
    layout: 'default',
    body: 'research.html',
    title: 'Research & Development — BLKPVNTHR LLC',
    description:
      'The BLKPVNTHR research agenda: evidence-grounded computational intelligence, provenance, temporal knowledge, independent verification, and reproducible research.',
    sitemap: { changefreq: 'monthly', priority: 0.9 }
  },
  {
    out: 'research/strix.html',
    canonicalPath: '/research/strix',
    active: 'research',
    layout: 'default',
    body: 'strix.html',
    title: 'STRIX — Flagship Research Initiative — BLKPVNTHR LLC',
    description:
      'STRIX is a research-stage platform investigating independently verifiable, temporally relevant, evidence-supported, and reproducible conclusions.',
    sitemap: { changefreq: 'monthly', priority: 0.9 }
  },
  {
    out: 'technologies.html',
    canonicalPath: '/technologies',
    active: 'technologies',
    layout: 'default',
    body: 'technologies.html',
    title: 'Technologies — BLKPVNTHR LLC',
    description:
      'The BLKPVNTHR technology portfolio with accurate maturity indicators: STRIX (research), applied computational engineering, and PantherByte commercial services.',
    sitemap: { changefreq: 'monthly', priority: 0.8 }
  },
  {
    out: 'applications.html',
    canonicalPath: '/applications',
    active: 'applications',
    layout: 'default',
    body: 'applications.html',
    title: 'Applications — BLKPVNTHR LLC',
    description:
      'Potential institutional applications for trustworthy computational intelligence across engineering, scientific research, software, and regulated environments.',
    sitemap: { changefreq: 'monthly', priority: 0.7 }
  },
  {
    out: 'commercialization.html',
    canonicalPath: '/commercialization',
    active: 'commercialization',
    layout: 'default',
    body: 'commercialization.html',
    title: 'Commercialization — BLKPVNTHR LLC',
    description:
      'BLKPVNTHR commercialization: proprietary research-to-market strategy, applied computational technologies, external technology licensing, and engineering services.',
    sitemap: { changefreq: 'monthly', priority: 0.7 }
  },
  {
    out: 'publications.html',
    canonicalPath: '/publications',
    active: 'research',
    layout: 'default',
    body: 'publications.html',
    title: 'Research Library — BLKPVNTHR LLC',
    description:
      'The BLKPVNTHR research library for approved technical reports, white papers, experimental findings, reproducibility documentation, and research announcements.',
    sitemap: { changefreq: 'monthly', priority: 0.5 }
  },
  {
    out: 'company.html',
    canonicalPath: '/company',
    active: 'company',
    layout: 'default',
    body: 'company.html',
    title: 'Company — BLKPVNTHR LLC',
    description:
      'BLKPVNTHR LLC is an engineering-led Maryland company building evidence-grounded computational intelligence and research infrastructure for institutions.',
    sitemap: { changefreq: 'monthly', priority: 0.7 }
  },
  {
    out: 'partnerships.html',
    canonicalPath: '/partnerships',
    active: 'company',
    layout: 'default',
    body: 'partnerships.html',
    title: 'Partnerships & Customer Discovery — BLKPVNTHR LLC',
    description:
      'Pathways for research collaboration, institutional demonstrations, technical advisors, commercial design partners, and technology licensing with BLKPVNTHR LLC.',
    sitemap: { changefreq: 'monthly', priority: 0.6 }
  },
  {
    out: 'contact.html',
    canonicalPath: '/contact',
    active: 'contact',
    layout: 'default',
    body: 'contact.html',
    title: 'Contact — BLKPVNTHR LLC',
    description:
      'Contact BLKPVNTHR LLC to discuss research collaboration, institutional demonstrations, technology licensing, or a strategic opportunity.',
    sitemap: { changefreq: 'monthly', priority: 0.6 }
  },
  {
    out: 'privacy.html',
    canonicalPath: '/privacy',
    active: null,
    layout: 'slim',
    body: 'privacy.html',
    title: 'Privacy Policy — BLKPVNTHR LLC',
    description: 'How BLKPVNTHR LLC handles information collected through blkpvnthr.com.',
    sitemap: { changefreq: 'yearly', priority: 0.3 }
  },
  {
    out: 'terms.html',
    canonicalPath: '/terms',
    active: null,
    layout: 'slim',
    body: 'terms.html',
    title: 'Terms of Use — BLKPVNTHR LLC',
    description: 'Terms governing use of the BLKPVNTHR LLC website at blkpvnthr.com.',
    sitemap: { changefreq: 'yearly', priority: 0.3 }
  },
  {
    out: '404.html',
    canonicalPath: null,
    active: null,
    layout: 'slim',
    body: '404.html',
    robots: 'noindex, follow',
    title: 'Page not found — BLKPVNTHR LLC',
    description: 'The requested page could not be found on blkpvnthr.com.',
    sitemap: false
  }
];
