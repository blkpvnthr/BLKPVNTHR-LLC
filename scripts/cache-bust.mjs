#!/usr/bin/env node
/**
 * Append content-hash query strings to local asset references so a redeploy is
 * picked up immediately instead of waiting out the browser's asset cache.
 *
 * Run against a *staging copy* of the publish set, never the source tree — the
 * committed HTML stays hash-free so format:check and validate.mjs see stable
 * files. deploy.sh stages site/ to a temp dir, runs this, then packages the dir.
 *
 * How it works with the live nginx policy:
 *   - HTML is served `expires -1` (always revalidated) → the next visit after a
 *     deploy always fetches HTML carrying the new ?v= hashes.
 *   - /assets/* is served `max-age=3600`; a new hash is a new URL, so it is a
 *     guaranteed cache miss, while unchanged assets keep their stable URL and
 *     stay cached between deploys.
 *
 * Every /assets/<file> reference in each HTML page is rewritten to
 * /assets/<file>?v=<hash>, where <hash> is the first 10 hex chars of the
 * SHA-256 of that asset's bytes. Absolute (/assets/…) and full-URL
 * (https://blkpvnthr.com/assets/…) forms are both handled; an existing ?v= is
 * refreshed rather than doubled.
 *
 * Usage: node scripts/cache-bust.mjs <site-dir>
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'site');

// /assets/<file>.<ext> with an optional pre-existing ?v=<hex> to overwrite.
// Covers stylesheets, scripts, images, and hover-preview media.
const ASSET_RE =
  /\/assets\/([A-Za-z0-9._-]+\.(?:css|js|png|webp|avif|jpe?g|gif|svg|ico|mp4|webm))(?:\?v=[a-f0-9]+)?/g;

const hashes = new Map();
function hashFor(relPath) {
  if (hashes.has(relPath)) return hashes.get(relPath);
  let hash = null;
  try {
    hash = createHash('sha256')
      .update(readFileSync(join(root, relPath)))
      .digest('hex')
      .slice(0, 10);
  } catch {
    hash = null; // referenced asset not in the publish set — leave the ref alone
  }
  hashes.set(relPath, hash);
  return hash;
}

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

let versioned = 0;
let missing = 0;
for (const file of htmlFiles(root)) {
  const src = readFileSync(file, 'utf8');
  const next = src.replace(ASSET_RE, (match, fname) => {
    const hash = hashFor(`assets/${fname}`);
    if (!hash) {
      missing++;
      return match;
    }
    versioned++;
    return `/assets/${fname}?v=${hash}`;
  });
  if (next !== src) writeFileSync(file, next);
}

console.log(`cache-bust: versioned ${versioned} reference(s) in ${root}`);
if (missing) console.log(`cache-bust: ${missing} reference(s) had no matching asset (left as-is)`);
