# BLKPVNTHR LLC — blkpvnthr.com

Corporate website for BLKPVNTHR LLC. Static HTML, CSS, and vanilla JavaScript with no build
step, matching the stack used by the sibling PantherByte site.

## Layout

```
site/                 # everything that gets published — the deploy artifact
  index.html          # the one-page corporate site
  privacy.html
  terms.html
  404.html
  robots.txt
  sitemap.xml
  assets/
    styles.css        # design system + all page styles
    main.js           # nav, scenario model, scroll-spy, reveal
    blkpvnthr-mark.png, favicon-{32,180,512}.png, og-card.png
scripts/
  validate.mjs        # zero-dependency verification (also runs in CI)
  build-assets.py     # regenerates icons and the social card
deploy/
  deploy.sh           # verify → package → atomic release swap on the Oracle VM
  nginx-blkpvnthr.conf # the blkpvnthr.com server block
docs/                 # PRIVATE corporate records — gitignored, never published
.github/workflows/verify.yml
```

> **`docs/` must never be committed.** This repository is public. It is listed in
> `.gitignore`, both CI and `deploy/deploy.sh` fail if any document file appears under `site/`,
> and only `site/` is ever packaged for deployment, so repo-root files are never served.

## Commands

```bash
npm install          # prettier only
npm run dev          # serve site/ at http://localhost:4321
npm run format       # prettier --write
npm test             # format:check + validate
```

`npm run validate` checks metadata, internal link and anchor integrity, accessibility basics,
WCAG contrast of the colour tokens, undefined CSS custom properties, and — importantly — a set
of **claim-safety rules**. Those rules fail the build if the site ever starts asserting a
licence, partnership, endorsement, certification, customer, or award the company does not have,
or if the required ReactorCast disclosure copy is removed. Keep them in CI.

Regenerating brand assets requires Pillow: `python3 scripts/build-assets.py`.

## Design system

Strict monochrome. Near-black base (`#0a0a0a`), graphite panels, 1px low-opacity hairlines,
ivory text. Exactly one accent — a desaturated sage `#8fb4a2` — reserved for functional signal
only: the active scenario series, the active nav indicator, the availability status, and focus
rings. It is never used decoratively.

Type: **Sora** (display), **Inter** (body), **JetBrains Mono** (technical labels), loaded from
Google Fonts, matching PantherByte. Note that PantherByte's stylesheet references a `--text-*`
scale it never defines; this one defines the scale explicitly, and `validate.mjs` fails on any
undefined custom property so the bug cannot recur.

No shadows, gradients, or glassmorphism. Motion is limited to short fades and is disabled
entirely under `prefers-reduced-motion`.

## Content accuracy

The site is written to support a technology-licensing conversation, so accuracy constraints are
deliberate and load-bearing:

- ReactorCast is described only as something BLKPVNTHR **is evaluating**. The site states
  plainly that the company has not licensed it and is not affiliated with or endorsed by LANL
  or DOE.
- No customers, contracts, partners, awards, testimonials, metrics, certifications, clearances,
  or deployments are claimed.
- The founder's NASA and JHU/APL experience is described as prior engineering work, never as
  endorsement or partnership.
- The hero scenario panel is labelled "Illustrative system model" with a "Synthetic data" tag
  and an "Interface concept — not a product screenshot" footer. Its numbers are invented and
  live in `SCENARIOS` in `assets/main.js`.

## Deployment — Oracle VM (LIVE)

Live at **https://blkpvnthr.com** on the same Oracle Cloud VM as `os.blkpvnthr.com`
(`150.136.62.159`, `ubuntu@`, key `~/.ssh/oracle`, Ubuntu 24.04, nginx 1.24). It has its own
release tree at `/var/www/blkpvnthr.com/` so it never collides with the OS app under
`/var/www/blk/`. nginx serves `/var/www/blkpvnthr.com/current`, a symlink the deploy script flips
atomically for zero-downtime releases. Files are owned `root:root` (755/644) — not writable by
the `www-data` web-server process.

The vhost (`/etc/nginx/sites-available/blkpvnthr.com`) is an isolated server block — explicit
`server_name` only, no `default_server` — so it never captures `os` / `plaid` / `queen` or any
other subdomain. TLS uses this box's certbot convention (`options-ssl-nginx.conf` + dhparam),
shared with the other vhosts.

### Subsequent content deploys

```bash
bash deploy/deploy.sh
```

Runs the CI checks (formatting, link/claim validation, private-file guard), packages `site/`,
uploads, extracts into a new `releases/<ts>/`, sets `root:root` 755/644, and flips the `current`
symlink atomically, then reloads nginx. The last 5 releases are kept.

### Rollback

```bash
ssh -i ~/.ssh/oracle ubuntu@150.136.62.159 '
  ls /var/www/blkpvnthr.com/releases/                         # pick the target <ts>
  sudo ln -sfn /var/www/blkpvnthr.com/releases/<ts> /var/www/blkpvnthr.com/current.tmp &&
  sudo mv -Tf /var/www/blkpvnthr.com/current.tmp /var/www/blkpvnthr.com/current &&
  sudo systemctl reload nginx'
```

### TLS / renewal

Certificate for `blkpvnthr.com` + `www.blkpvnthr.com` was issued via the **webroot**
authenticator (`-w /var/www/blkpvnthr.com/current`). Because webroot has no installer, a global
deploy hook at `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads nginx after each
renewal so the fresh cert is served. Auto-renewal runs via the active `certbot.timer`. Manual
renew: `sudo certbot renew --cert-name blkpvnthr.com`.

> Note: `certbot renew --dry-run` stalls on this box because Let's Encrypt's **staging** endpoint
> is unresponsive to certbot from here; **production** issuance and a forced production renewal
> both succeeded, so real renewals work. Use `--force-renewal` (production) to test, not
> `--dry-run`.

### If DNS ever needs re-pointing

| Record | Name | Value |
| --- | --- | --- |
| A | `@` | `150.136.62.159` |
| CNAME | `www` | `blkpvnthr.com` |

## Verification performed

Formatter, validator, production smoke test on `serve`, and browser checks in Chrome: no page
console errors; layout verified with no horizontal overflow or escaping elements at 360, 390,
768, 1024, 1280, and 1440px; scenario tablist verified for mouse, arrow-key wrap, roving
tabindex, and metric synchronisation; mobile nav disclosure verified; scroll-spy verified;
`/privacy.html`, `/terms.html`, and the custom 404 verified; external links to
`os.blkpvnthr.com` and `pantherbyte.org` return 200.
