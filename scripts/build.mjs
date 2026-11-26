#!/usr/bin/env node
/**
 * BLKPVNTHR LLC — zero-dependency static-site build.
 *
 * Source of truth lives in `src/`:
 *   src/data/site.mjs   global config: origin, primary nav, footer model, PAGES
 *   src/partials/*.html shared chrome (head, header, footer, footer-slim, …)
 *   src/pages/*.html     per-route <main> body fragments
 *   src/assets/**        copied verbatim to site/assets/
 *   src/static/**        copied verbatim to site/ root (robots.txt, vercel.json)
 *
 * It assembles complete, independent HTML files into `site/` (the deploy
 * artifact Vercel serves), then generates sitemap.xml from the approved routes.
 *
 * Fail-closed guarantees (a broken build is better than a wrong one):
 *   - a referenced partial, body fragment, or required metadata field missing
 *     → throw. Nothing is half-written.
 *   - any unresolved `{{token}}` left in output → throw.
 *   - no network access, no third-party dependencies: Node built-ins only, so
 *     the build is deterministic and reproducible.
 *
 * Usage: node scripts/build.mjs   (also `npm run build`)
 */

import {
  readFileSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  cpSync,
  existsSync,
  readdirSync,
  statSync
} from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, PAGES } from '../src/data/site.mjs';
import { MODULES, NAV } from '../src/data/admin-modules.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'site');
const PARTIALS_DIR = join(SRC, 'partials');
const PAGES_DIR = join(SRC, 'pages');

/* ---------------------------------------------------------------- helpers */

const read = (p) => readFileSync(p, 'utf8');
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Load every partial once: name (sans .html) -> contents. */
function loadPartials() {
  const out = {};
  for (const f of readdirSync(PARTIALS_DIR)) {
    if (f.endsWith('.html')) out[f.replace(/\.html$/, '')] = read(join(PARTIALS_DIR, f));
  }
  return out;
}

/**
 * Resolve `{{> partial}}` includes (recursively), then `{{ KEY }}` variables.
 * A missing partial or variable throws — the build fails closed.
 */
function render(tpl, vars, partials, where) {
  let html = tpl;
  // Includes (bounded depth guard against accidental partial recursion).
  for (let depth = 0; depth < 10 && /\{\{>\s*[\w-]+\s*\}\}/.test(html); depth++) {
    html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`${where}: unknown partial "{{> ${name}}}"`);
      return partials[name];
    });
  }
  // Variables.
  html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? o : o[k]), vars);
    if (val == null) throw new Error(`${where}: missing variable "{{ ${key} }}"`);
    return String(val);
  });
  return html;
}

/* --------------------------------------------------------- head / chrome */

function headMeta(page) {
  const origin = SITE.origin;
  const canonical = page.canonicalPath ? origin + page.canonicalPath : null;
  const ogImage = origin + (page.ogImage || SITE.ogImage);
  const ogTitle = page.ogTitle || page.title;
  const ogDescription = page.ogDescription || page.description;

  // 404 (and any noindex page) carries no canonical / Open Graph, matching the
  // validator's expectation that the error page is purely noindex.
  const social = canonical
    ? [
        `<link rel="canonical" href="${esc(canonical)}" />`,
        `<meta property="og:type" content="${esc(page.ogType || 'website')}" />`,
        `<meta property="og:site_name" content="BLKPVNTHR LLC" />`,
        `<meta property="og:url" content="${esc(canonical)}" />`,
        `<meta property="og:title" content="${esc(ogTitle)}" />`,
        `<meta property="og:description" content="${esc(ogDescription)}" />`,
        `<meta property="og:image" content="${esc(ogImage)}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${esc(SITE.ogImageAlt)}" />`,
        `<meta property="og:locale" content="en_US" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${esc(ogTitle)}" />`,
        `<meta name="twitter:description" content="${esc(ogDescription)}" />`,
        `<meta name="twitter:image" content="${esc(ogImage)}" />`
      ].join('\n    ')
    : '';

  const jsonld = page.jsonld
    ? `<script type="application/ld+json">\n${JSON.stringify(page.jsonld, null, 2)}\n    </script>`
    : '';

  return {
    TITLE: esc(page.title),
    DESCRIPTION: esc(page.description),
    ROBOTS: page.robots || 'index, follow',
    SOCIAL: social,
    JSONLD: jsonld,
    EXTRA_HEAD: page.extraHead || ''
  };
}

/**
 * Primary nav links. aria-current="page" is set ONLY on the link whose href is
 * the page's own canonical path, so pages that are not themselves top-level nav
 * items (partnerships, publications, research/strix) correctly mark no link
 * current instead of falsely tagging a parent/sibling link.
 */
function navLinks(activePath) {
  const links = SITE.nav
    .map((item) => {
      const current = item.href === activePath ? ' aria-current="page"' : '';
      return `<a class="nav-link" href="${esc(item.href)}"${current}>${esc(item.label)}</a>`;
    })
    .join('\n          ');
  const cta = `<a class="btn btn-primary btn-sm nav-cta" href="${esc(SITE.navCta.href)}">${esc(SITE.navCta.label)}</a>`;
  return `${links}\n          ${cta}`;
}

/** Full footer column links from the footer model. */
function footerColumns() {
  return SITE.footer.columns
    .map((col) => {
      const items = col.links
        .map((l) => {
          const rel = l.external ? ' rel="noopener"' : '';
          return `<li><a href="${esc(l.href)}"${rel}>${esc(l.label)}</a></li>`;
        })
        .join('\n              ');
      return `<div>\n            <h2 class="footer-heading">${esc(col.title)}</h2>\n            <ul class="footer-links">\n              ${items}\n            </ul>\n          </div>`;
    })
    .join('\n\n          ');
}

/** Shared template for a generated administrative record-module page. The page
 * carries its table config as inert JSON; shell.js + datatable.js + page.js do
 * the work (no inline scripts, CSP script-src 'self'). */
function adminModulePage(title, cfg) {
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta name="color-scheme" content="dark" />
    <title>${esc(title)} · BLKPVNTHR LLC Admin</title>
    <link rel="icon" href="/assets/favicon-32.png" sizes="32x32" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/admin/assets/admin.css" />
    <script src="/admin/assets/env.js"></script>
    <script src="/admin/assets/modules.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#view">Skip to main content</a>
    <div class="app">
      <aside class="side" id="side"></aside>
      <div>
        <header class="topbar" id="topbar"></header>
        <main id="view" class="main" tabindex="-1"></main>
      </div>
    </div>
    <script type="application/json" id="table-config">${json}</script>
    <script src="/admin/assets/admin-api.js"></script>
    <script src="/admin/assets/shell.js"></script>
    <script src="/admin/assets/datatable.js"></script>
    <script src="/admin/assets/page.js"></script>
  </body>
</html>
`;
}

/* ------------------------------------------------------------------ build */

function build() {
  const partials = loadPartials();

  // Clean + recreate the output tree deterministically.
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // Static passthrough: assets/** then root static files (robots.txt).
  if (existsSync(join(SRC, 'assets')))
    cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });
  if (existsSync(join(SRC, 'static'))) cpSync(join(SRC, 'static'), OUT, { recursive: true });

  // Admin portal: a self-contained app copied verbatim to site/admin/ (it does
  // NOT use the marketing head/header/footer partials or templating). Its public
  // runtime config (Supabase URL + publishable key) is injected from the
  // environment so the same source deploys to every environment with no
  // hardcoded values. Secrets are never written here — only public, client-safe
  // values. The admin tree is excluded from scripts/validate.mjs.
  if (existsSync(join(SRC, 'admin'))) {
    cpSync(join(SRC, 'admin'), join(OUT, 'admin'), { recursive: true });
    mkdirSync(join(OUT, 'admin', 'assets'), { recursive: true });
    const adminEnv = {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || ''
    };
    writeFileSync(
      join(OUT, 'admin', 'assets', 'env.js'),
      `window.__ADMIN_ENV__ = ${JSON.stringify(adminEnv)};\n`
    );
    // Nav + built-slug registry consumed by the shell.
    writeFileSync(
      join(OUT, 'admin', 'assets', 'modules.js'),
      `window.__ADMIN_MODULES__ = ${JSON.stringify({ nav: NAV, built: MODULES.map((m) => m.slug) })};\n`
    );
    // One page per record module, generated from the shared template.
    for (const m of MODULES) {
      const cfg = {
        resource: `${m.schema}.${m.table}`,
        title: m.title,
        subtitle: m.subtitle,
        columns: m.columns,
        filters: (m.filters || []).map((k) => ({
          key: k,
          label: (m.columns.find((c) => c.key === k) || {}).label || k
        }))
      };
      writeFileSync(join(OUT, 'admin', `${m.slug}.html`), adminModulePage(m.title, cfg));
    }
  }

  const routes = [];

  for (const page of PAGES) {
    const where = `pages/${page.body}`;
    if (!page.out || !page.title || !page.description) {
      throw new Error(`site.mjs: page "${page.out || '(no out)'}" missing out/title/description`);
    }
    const bodyPath = join(PAGES_DIR, page.body);
    if (!existsSync(bodyPath)) throw new Error(`${where}: body fragment not found`);

    const footerPartial = page.layout === 'slim' ? 'footer-slim' : 'footer';
    const vars = {
      ...headMeta(page),
      NAV_LINKS: navLinks(page.canonicalPath),
      FOOTER_COLUMNS: page.layout === 'slim' ? '' : footerColumns(),
      YEAR: SITE.year,
      BODY: render(read(bodyPath), {}, partials, where)
    };

    // Compose: head partial + header partial + body + chosen footer partial.
    const doc = render(
      `<!doctype html>
<html lang="en">
  <head>
    {{> head}}
  </head>

  <body>
    <a class="skip-link" href="#main">Skip to main content</a>

    {{> header}}

    <main id="main" tabindex="-1">
{{ BODY }}
    </main>

    {{> ${footerPartial}}}

    <script src="/assets/main.js" defer></script>
  </body>
</html>
`,
      vars,
      partials,
      `page ${page.out}`
    );

    if (/\{\{/.test(doc)) {
      const stray = doc.match(/\{\{[^}]*\}\}/g) || [];
      throw new Error(`page ${page.out}: unresolved token(s): ${[...new Set(stray)].join(', ')}`);
    }

    const dest = join(OUT, page.out);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, doc);

    if (page.sitemap !== false && page.canonicalPath) {
      routes.push({
        loc: SITE.origin + page.canonicalPath,
        changefreq: page.sitemap?.changefreq || 'monthly',
        priority: page.sitemap?.priority ?? 0.5,
        lastmod: SITE.lastmod
      });
    }
  }

  // sitemap.xml from the approved, indexable routes only.
  const urls = routes
    .map(
      (r) =>
        `  <url>\n    <loc>${r.loc}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority.toFixed(1)}</priority>\n  </url>`
    )
    .join('\n');
  writeFileSync(
    join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );

  const built = PAGES.length;
  const assetCount = existsSync(join(OUT, 'assets')) ? walk(join(OUT, 'assets')).length : 0;
  console.log(
    `\nBuilt ${built} page(s) + ${routes.length} sitemap route(s) + ${assetCount} asset(s) → ${relative(ROOT, OUT)}/\n`
  );
}

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const f = join(dir, e);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
}

try {
  build();
} catch (err) {
  console.error(`\nBuild FAILED — ${err.message}\n`);
  process.exit(1);
}
