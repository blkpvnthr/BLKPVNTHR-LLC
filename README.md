# BLKPVNTHR LLC — blkpvnthr.com

Corporate website for BLKPVNTHR LLC. Static HTML, CSS, and vanilla JavaScript, generated from
shared partials by a **zero-dependency Node build**, and hosted on Vercel. No runtime framework and
no server: the output is plain static files.

## Layout

```
src/                  # SOURCE OF TRUTH
  data/site.mjs       # site config: canonical origin, nav model, footer model, per-page metadata (PAGES)
  partials/           # shared chrome: head, header, footer, footer-slim
  pages/              # one <main> body fragment per route
  assets/             # styles.css, main.js, images, favicons, og-card  (copied verbatim)
  static/             # copied to the site root: robots.txt, vercel.json
scripts/
  build.mjs           # assembles src/ -> site/, generates sitemap.xml, fails closed on missing tokens
  validate.mjs        # metadata, link/anchor integrity, a11y, WCAG token contrast, CLAIM-SAFETY
  claims.mjs          # claim-safety rules (shared with the regression suite)
  *.test.mjs          # unit tests (claim safety + evidence-graph init)
site/                 # GENERATED build output — the deploy artifact. Git-ignored; do not edit by hand.
docs/                 # PRIVATE corporate records + implementation reports — git-ignored, never published
```

## Commands

```bash
npm run build         # src/ -> site/
npm run dev           # build, then serve site/ at http://localhost:4321
npm run validate      # build, then run scripts/validate.mjs on the output
npm run format        # prettier --write on src/ and scripts/
npm test              # format:check + validate + unit tests  (the CI gate)
npm run clean         # remove the generated site/
```

`validate.mjs` checks metadata, internal link/anchor integrity, accessibility basics, WCAG contrast of
the colour tokens, undefined CSS custom properties, and a set of **claim-safety rules** that fail the
build if the site ever asserts a licence, partnership, endorsement, certification, customer, award,
NSF funding, or patent the company does not have. Keep them in CI.

## Design system

Strict monochrome. Near-black base (`#0a0a0a`), graphite panels, 1px hairlines, ivory text. Exactly one
accent — a desaturated sage `#8fb4a2` — reserved for functional signal only (active series, active nav,
availability status, focus rings). Type: **Sora** (display), **Inter** (body), **JetBrains Mono** (labels).
No shadows, gradients, or glassmorphism; motion is short fades, disabled under `prefers-reduced-motion`.

## Content accuracy (load-bearing)

- **STRIX and the research agenda are research-stage.** They are described as research objectives, open
  questions, and proposed validation — never as validated performance, and with no quantitative results.
- No NSF funding/approval/endorsement, patents or "patent-pending", certifications/clearances,
  partnerships/affiliations, customers/deployments, or awards are claimed.
- The founder's NASA and JHU/APL experience is described as prior engineering work, never as endorsement
  or partnership.
- Conceptual diagrams (e.g. the decision-evidence graph) are labelled conceptual representations with
  synthetic positions — not product screenshots or measured data.
- The site has **no contact forms, no analytics, no cookies, and no tracking**; the only third-party
  request is Google Fonts. Only `@blkpvnthr.com` email addresses appear.

## Deployment — Vercel

Live at **https://blkpvnthr.com** on Vercel (project `blkpvnthr-llc`, team `panther-byte`). The project's
Root Directory is `site`; Vercel serves the prebuilt output directly (no Vercel-side build). A strict
`.vercelignore` allowlist uploads only `site/`, so source, `docs/`, and private files never leave the
machine.

```bash
npm run build && vercel deploy        # protected PREVIEW (SSO-gated, noindex)
npm run build && vercel deploy --prod # PRODUCTION — only with explicit approval
```

`src/static/vercel.json` provides clean URLs (`/privacy` served from `privacy.html`, `.html` → clean 308)
and the security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Strict-Transport-Security`). Preview deployments carry `x-robots-tag: noindex`.

> The `deploy/` directory (Oracle VM + nginx) is **legacy** from before the site moved to Vercel and is
> retained for reference only.
