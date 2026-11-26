#!/usr/bin/env node
/**
 * Zero-dependency verification for the BLKPVNTHR LLC static site.
 *
 * Four groups of checks:
 *   1. Metadata      — title, description, canonical, Open Graph, card, icons
 *   2. Link integrity — in-page anchors, local pages, local assets, duplicate ids
 *   3. Accessibility  — lang, single h1, alt text, accessible names, heading order
 *   4. Claim safety   — blocks language that would assert a licence, partnership,
 *                       endorsement, certification, or customer the company does
 *                       not have. This is the automated form of the accuracy
 *                       requirement and should stay in CI permanently.
 *
 * Usage: node scripts/validate.mjs [siteDir]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { stripInert, findClaimViolations } from './claims.mjs';

const SITE = resolve(process.argv[2] ?? 'site');
const CANONICAL_ORIGIN = 'https://blkpvnthr.com';

const errors = [];
const warnings = [];

const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

/* ---------------------------------------------------------------- helpers */

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// The admin portal (site/admin/**) is a separate app with its own design system
// and tests; it does not follow the marketing site's metadata/claim conventions,
// so it is excluded from this validator.
const all = walk(SITE).filter((f) => {
  const r = relative(SITE, f);
  return r !== 'admin' && !r.startsWith('admin/') && !r.startsWith('admin\\');
});
const htmlFiles = all.filter((f) => f.endsWith('.html'));
const rel = (f) => relative(SITE, f);

// stripInert + findClaimViolations are imported from ./claims.mjs (see top).

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function metaContent(html, key, kind = 'name') {
  const found = tags(html, 'meta').find(
    (t) => (attr(t, kind) ?? '').toLowerCase() === key.toLowerCase()
  );
  return found ? attr(found, 'content') : null;
}

/* ------------------------------------------------------- 1. metadata checks */

const REQUIRED_OG = ['og:type', 'og:url', 'og:title', 'og:image'];

for (const file of htmlFiles) {
  const raw = readFileSync(file, 'utf8');
  const name = rel(file);
  const is404 = name === '404.html';

  if (!/<html[^>]+lang="en"/i.test(raw)) fail(name, 'missing <html lang="en">');
  if (!/<meta\s+charset="utf-8"/i.test(raw)) fail(name, 'missing charset');
  if (!/name="viewport"/i.test(raw)) fail(name, 'missing viewport meta');

  const title = raw.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) fail(name, 'missing <title>');
  else if (title.length > 70)
    warn(name, `title is ${title.length} chars (>70 may truncate in SERPs)`);

  const desc = metaContent(raw, 'description');
  if (!desc) fail(name, 'missing meta description');
  else if (desc.length > 165)
    warn(name, `meta description is ${desc.length} chars (>165 truncates)`);

  // 404 is intentionally noindex and carries no canonical.
  if (!is404) {
    const canonical = tags(raw, 'link').find((t) => attr(t, 'rel') === 'canonical');
    if (!canonical) fail(name, 'missing canonical link');
    else if (!attr(canonical, 'href')?.startsWith(CANONICAL_ORIGIN))
      fail(name, `canonical does not point at ${CANONICAL_ORIGIN}`);

    for (const key of REQUIRED_OG) {
      if (!metaContent(raw, key, 'property')) fail(name, `missing ${key}`);
    }
    if (metaContent(raw, 'twitter:card') !== 'summary_large_image')
      fail(name, 'twitter:card must be "summary_large_image"');
  } else if (!/name="robots"[^>]*noindex/i.test(raw)) {
    fail(name, '404 page must be noindex');
  }

  if (!tags(raw, 'link').some((t) => (attr(t, 'rel') ?? '').includes('icon')))
    fail(name, 'missing favicon link');
}

/* -------------------------------------------- 2. link and asset integrity */

const pageIds = new Map();

for (const file of htmlFiles) {
  const html = stripInert(readFileSync(file, 'utf8'));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) fail(rel(file), `duplicate id(s): ${[...new Set(dupes)].join(', ')}`);
  pageIds.set(file, new Set(ids));
}

let externalLinks = new Set();

for (const file of htmlFiles) {
  const html = stripInert(readFileSync(file, 'utf8'));
  const name = rel(file);
  const ids = pageIds.get(file);

  const refs = [
    ...tags(html, 'a').map((t) => attr(t, 'href')),
    ...tags(html, 'link').map((t) => attr(t, 'href')),
    ...tags(html, 'script').map((t) => attr(t, 'src')),
    ...tags(html, 'img').map((t) => attr(t, 'src'))
  ].filter(Boolean);

  for (const href of refs) {
    if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    if (href.startsWith('http')) {
      externalLinks.add(href);
      continue;
    }

    // Same-page anchor
    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (id && !ids.has(id)) fail(name, `anchor "${href}" has no matching id`);
      continue;
    }

    // Root-relative or relative path — split off any fragment
    const [path, frag] = href.split('#');
    if (!path) continue;

    const target = path.startsWith('/') ? join(SITE, path) : resolve(dirname(file), path);

    let resolved = path.endsWith('/') || path === '/' ? join(target, 'index.html') : target;

    // Clean (extensionless) URLs resolve on the server via nginx
    // `try_files $uri $uri.html $uri/`: /privacy is served from privacy.html.
    // Mirror that here so extensionless links validate instead of 404-ing.
    if (!existsSync(resolved) && !resolved.endsWith('.html') && existsSync(`${resolved}.html`)) {
      resolved = `${resolved}.html`;
    }

    if (!existsSync(resolved)) {
      fail(name, `broken local reference "${href}" (expected ${relative(SITE, resolved)})`);
      continue;
    }

    if (frag && resolved.endsWith('.html')) {
      const targetIds = pageIds.get(resolved);
      if (targetIds && !targetIds.has(frag))
        fail(name, `link "${href}" targets missing id "#${frag}"`);
    }
  }
}

/* --------------------------------------------------- 3. accessibility checks */

for (const file of htmlFiles) {
  const html = stripInert(readFileSync(file, 'utf8'));
  const name = rel(file);

  const h1s = html.match(/<h1\b/gi) ?? [];
  if (h1s.length === 0) fail(name, 'no <h1>');
  if (h1s.length > 1) fail(name, `${h1s.length} <h1> elements (expected exactly 1)`);

  for (const img of tags(html, 'img')) {
    if (attr(img, 'alt') === null) fail(name, `<img> without alt: ${img.slice(0, 70)}`);
  }

  // Links must have discernible text or an explicit label.
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const [, attrs, inner] = m;
    const text = inner
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z]+;/gi, '')
      .trim();
    const labelled = /aria-label=|aria-labelledby=/i.test(attrs);
    if (!text && !labelled) fail(name, `link without accessible name: <a${attrs.slice(0, 60)}>`);
  }

  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const [, attrs, inner] = m;
    const text = inner.replace(/<[^>]*>/g, '').trim();
    const labelled = /aria-label=|aria-labelledby=/i.test(attrs);
    if (!text && !labelled)
      fail(name, `button without accessible name: <button${attrs.slice(0, 60)}>`);
  }

  if (!/class="skip-link"/.test(html)) warn(name, 'no skip link');

  // Heading order must not skip a level.
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1)
      warn(name, `heading level jumps from h${levels[i - 1]} to h${levels[i]}`);
  }

  // ARIA tabs must reference a real panel.
  for (const tab of tags(html, 'button').filter((t) => attr(t, 'role') === 'tab')) {
    const controls = attr(tab, 'aria-controls');
    if (controls && !pageIds.get(file).has(controls))
      fail(name, `tab aria-controls="${controls}" has no matching id`);
    if (attr(tab, 'aria-selected') === null) fail(name, 'tab missing aria-selected');
  }
}

/* ------------------------------------------------------- 4. claim safety */

// Claim rules + matcher live in scripts/claims.mjs so the regression suite
// (scripts/claims.test.mjs) can exercise them against fixtures. Scans every
// HTML page and every .js file under the site.
for (const file of [...htmlFiles, ...all.filter((f) => f.endsWith('.js'))]) {
  const raw = readFileSync(file, 'utf8');
  for (const v of findClaimViolations(raw, file.endsWith('.html'))) {
    fail(rel(file), `claim check — ${v.label}: "${v.match}"`);
  }
}

// The former mandatory ReactorCast licensing disclaimer was removed: BLKPVNTHR is
// no longer pursuing that venture, so no ReactorCast content appears on the site.
// The claim rules in claims.mjs still fail the build if any licence, partnership,
// or endorsement with LANL/DOE is ever asserted, so a stray reintroduction cannot
// pass silently.

// LANL licensing contact addresses must never appear publicly.
for (const file of htmlFiles) {
  const raw = readFileSync(file, 'utf8');
  for (const m of raw.matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)) {
    if (!m[0].endsWith('@blkpvnthr.com'))
      fail(rel(file), `unexpected email address published: ${m[0]}`);
  }
}

/* --------------------------------------------- 5. WCAG contrast on tokens */

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const css = readFileSync(join(SITE, 'assets/styles.css'), 'utf8');
const token = (nameStr) =>
  css.match(new RegExp(`--${nameStr}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] ?? null;

const BG = token('bg');
const PANEL = token('panel');
// --panel-2 backs .model-bar and .model-foot, which carry the "Illustrative
// system model" and provenance labels in --ink-faint, so it must be checked too.
const PANEL2 = token('panel-2');
const PAIRS = [
  ['ink', BG, 4.5],
  ['ink-muted', BG, 4.5],
  ['ink-faint', BG, 4.5],
  ['ink-faint', PANEL, 4.5],
  ['ink-faint', PANEL2, 4.5],
  ['ink-muted', PANEL, 4.5],
  ['ink-muted', PANEL2, 4.5],
  ['accent', BG, 4.5],
  ['accent', PANEL, 3.0],
  ['accent', PANEL2, 3.0]
];

for (const [fg, bg, min] of PAIRS) {
  const color = token(fg);
  if (!color || !bg) {
    fail('styles.css', `could not resolve token --${fg}`);
    continue;
  }
  const ratio = contrast(color, bg);
  if (ratio < min)
    fail('styles.css', `--${fg} on ${bg} is ${ratio.toFixed(2)}:1, below the ${min}:1 minimum`);
}

// PantherByte's stylesheet references a --text-* scale it never defines; make
// sure this one does not inherit that bug.
for (const used of new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))) {
  if (!new RegExp(`\\s${used}:`).test(css)) fail('styles.css', `undefined custom property ${used}`);
}

/* -------------------------------------------------------------- reporting */

console.log(`\nValidated ${htmlFiles.length} HTML page(s) in ${rel(SITE) || SITE}/`);
console.log(`External links referenced: ${[...externalLinks].sort().join(', ') || 'none'}\n`);

if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  ~ ${w}`));
  console.log('');
}

if (errors.length) {
  console.error(`FAILED — ${errors.length} error(s):`);
  errors.forEach((e) => console.error(`  x ${e}`));
  console.error('');
  process.exit(1);
}

console.log('All checks passed.\n');
