# BLKPVNTHR LLC — Corporate Administration & Grant Readiness Portal
## Design, Architecture & Delivery Plan

**Status:** Draft for owner review · **Date:** 2026-11-26 · **Author:** engineering (Claude)
**Source of truth for requirements:** the owner's 38-section specification. This document
records the *live audit*, the *concrete architecture* that realizes that spec on the existing
stack, and the *phased delivery plan*. Where this document and the spec disagree, the spec wins
on *what*; this document governs *how*.

---

## 1. Authoritative audit (verified against live systems, 2026-11-26)

### 1.1 Repository
- Repo: `github.com/blkpvnthr/BLKPVNTHR-LLC` — **public**. Zero-dependency **build**: source of
  truth is `src/` (`data/site.mjs` routes, `partials/*.html` chrome, `pages/*.html` bodies,
  `assets/**`, `static/**`); `scripts/build.mjs` **wipes and regenerates `site/`** (git-ignored
  deploy artifact). `package.json` has `build`/`validate`/`test`. No `api/`, no backend, no
  `admin/` prior to this work. (Prod branch is `v2`; the `main`-based CI and worktree were behind.)
- CI (`.github/workflows/verify.yml`, triggers on **`main`**) runs `format:check`, `validate`
  (`npm run build` + `scripts/validate.mjs site`), `test:unit`, and a private-file guard
  (no `*.pdf/xlsx/csv` under `site/`). **Claim-safety + private-file gates are load-bearing and
  must keep passing.** `validate.mjs` will be scoped to skip `site/admin/`.
- `docs/` is git-ignored (private corporate records). Technical docs for this portal will live in
  `docs/admin/` with a `.gitignore` carve-out so they are version-controlled; **no private
  records or secrets may be placed in `docs/admin/`.**

### 1.2 Hosting (contradiction resolved)
- `README.md` claims the site is live on an Oracle VM — **this is stale.** Live DNS
  (`blkpvnthr.com` → Vercel `216.150.1.1`, `www` → `*.vercel-dns`) and response headers
  (`server: Vercel`) confirm **production is on Vercel.** README to be corrected.

### 1.3 Vercel
- Team **`panther-byte`** (`team_bEhxT0ft24LJAlBR67zfkS8W`), plan **PRO** (⇒ custom Firewall/WAF
  rules available). Project **`blkpvnthr-llc`** (`prj_bdHf9tOsBUtOFZ13AryQAKStMNf1`).
- Domains: `blkpvnthr.com`, `www.blkpvnthr.com` (verified). **Production branch `v2`.** Current
  model: **prebuilt-static** — `npm run build` locally, then `vercel deploy --prod` uploads only
  `site/` (per `.vercelignore`), Root Directory = `site`, no Vercel-side build (~2s deploys).
  Previews + prod `*.vercel.app` are **SSO-protected** (admin previews stay private — good).
- **Several `v2` builds are `ERROR`** (`auto: .remember …` commits); the live site is served by
  the last good *CLI* prod deploy. Cause: the `.remember` auto-commit path runs `vercel deploy`
  **without** `npm run build`, so there's no `site/`. The build-from-repo transition (P0) fixes
  this by making Vercel build `site/` on every deploy.
- **No project env vars set; no custom firewall configured** (default firewall applies).

### 1.4 Supabase
- Org **BLKPVNTHR LLC** (`ezcvdnnoyeyoxvhogeem`), plan **Free**.
- Projects: `PantherByte` (`yihcziyozdljzitseuiu`, paused — belongs to the separate PantherByte
  product, **do not touch**) and **`BLKPVNTHR-LLC` (`gbaepwxbatrctxoyeysm`)** — region
  `us-east-1`, `ACTIVE_HEALTHY`, Postgres 17.12, created 2026-11-26. **This is the admin system
  of record.** Manageable via MCP; CLI linked in the worktree.

### 1.5 Secrets available (names only; values never committed or echoed)
- `RESEND_API_KEY` (live) · `SUPABASE_PW` (DB password) · `SUPABASE_PUB_KEY`
  (publishable/anon) — in `.env.local` (main checkout, git-ignored). `VERCEL_OIDC_TOKEN` present
  but expired (inert). **No service-role key present** (by design — see §5).

---

## 2. Guiding constraints (non-negotiable)
1. **Scope isolation.** Work stays in the corporate-site repo + the `blkpvnthr-llc` Vercel
   project + the `gbaepwxbatrctxoyeysm` Supabase project. Never touch `os.blkpvnthr.com`,
   `pantherbyte.org`, the PantherByte Supabase project, or the live marketing site content.
2. **Public repo ⇒ all security is server-side.** No admin page renders sensitive data as a
   static file; admin pages are shells that fetch data via authenticated APIs. No secrets in git.
3. **Previews-first.** Everything is proven on SSO-protected preview deploys. Production
   (`blkpvnthr.com`, branch `v2`) changes only with explicit owner approval.
4. **Preserve existing behavior.** Marketing site, inquiry/mailto flows, SEO, claim-safety CI,
   and private-file guard all keep working.
5. **Honest status.** No mock integration is presented as functional. Deferred work is labeled.

---

## 3. Deploy topology

```
GitHub (public)           Vercel project blkpvnthr-llc            Supabase gbaepwxbatrctxoyeysm
──────────────            ────────────────────────────            ───────────────────────────
branch worktree-admin ──► preview deploy (SSO-protected) ──┐      Postgres (schemas + RLS)
   (development)                                            ├────► Auth (invite-only, TOTP MFA)
branch v2 (prod) ───────► production → blkpvnthr.com  ──────┘      Storage (private buckets)
                                                                   Edge Functions (privileged)
```

- `build.mjs` emits marketing pages to `site/` (unchanged) **and** copies `src/admin/**` verbatim
  to `site/admin/`. `api/admin/*` = Vercel Node functions; `middleware.ts` gates `/admin/*` and
  `/api/admin/*` at the edge. Root `vercel.json` carries headers + admin CSP + function config.

**Deploy-model transition (P0, owner-flagged).** Move the Vercel project from prebuilt-static to
**build-from-repo**: Root Directory = repo root, Build Command = `npm run build`, Output Directory
= `site`; revise `.vercelignore` to upload build inputs (`src/`, `scripts/`, `api/`,
`middleware.ts`, `package.json`, `package-lock.json`) instead of only `site/`. Validated on
SSO-protected previews before any production cutover. Fixes the failing `v2` builds as a side effect.

### Repo additions (non-destructive)
```
src/admin/        admin app source: SPA-shell pages + assets (css/js/images) + components
                  → copied verbatim to site/admin/ by build.mjs (no marketing templating)
api/admin/        Vercel Node functions: auth, session, csrf, data gateway, exports, documents, audit
api/_lib/         shared server code: supabase-ssr clients, auth guards, rbac, validation, audit, rate-limit
middleware.ts     Edge Middleware route gate (repo root)
vercel.json       root: build/routing/headers/functions (merges src/static/vercel.json headers)
supabase/         migrations/ · functions/ (edge) · seed.sql · tests/
docs/admin/       technical docs (committed via `!docs/admin/` .gitignore carve-out)
tests/            admin/ · security/ · integration/ (pytest + Playwright)
```
Build/CI integration: `validate.mjs` scoped to skip `site/admin/`; admin source formatted by the
existing prettier `format` script; private-file guard unaffected (documents live in Supabase Storage).

---

## 4. Security spine

- **Auth (Supabase):** email+password, mandatory email verification, **mandatory TOTP MFA
  (AAL2 required for all admin access)**, **invitation-only** (public signup + anonymous
  disabled). Owner account created via a one-time server-side invite — **no hardcoded creds**.
- **Sessions:** `@supabase/ssr` with **HTTP-only, Secure, SameSite cookies**; tokens **never** in
  localStorage. Vercel functions set/refresh cookies; short-lived access tokens; logout + session
  revocation; configurable inactivity timeout; reauth for sensitive ops.
- **Route protection:** **Edge Middleware** verifies session + AAL2 + active membership on every
  `/admin/*` and `/api/admin/*` request (redirect to `/admin/login.html` or `401`). Server-side,
  not a client guard. Public exceptions: `login.html`, `reset-password.html`, `mfa.html`, and
  non-sensitive assets.
- **CSRF:** double-submit token on all state-changing cookie-authenticated requests.
- **RBAC:** roles Owner / Administrator / Finance Manager / Research Manager / Legal Reviewer /
  Auditor. Enforced in **both** Postgres RLS **and** the API. Role assignment is server-controlled;
  users cannot elevate their own privileges (RLS `WITH CHECK` + trigger).
- **Data access:** user JWT flows to Supabase ⇒ **RLS applies to every query**. Service-role key
  used only for narrow privileged ops inside Edge Functions.

---

## 5. Secrets & environment model

| Variable | Where it lives | Notes |
|---|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Vercel env (all), client-safe | `https://gbaepwxbatrctxoyeysm.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Vercel env (all), client-safe | from `SUPABASE_PUB_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Supabase Edge Function runtime only** (auto-injected); optionally Vercel server env if ever needed | never in git; never handled in plaintext by us if avoidable |
| `RESEND_API_KEY` | Vercel server env + Supabase Auth SMTP | server-only |
| `SESSION_COOKIE_SECRET` / CSRF secret | Vercel server env | generated |
| DB password (`SUPABASE_PW`) | local `.env.local` only | not needed at runtime (MCP/PostgREST used) |

Privileged operations (invite issuance, owner bootstrap, background jobs) run as **Supabase Edge
Functions**, which receive the service role from their own runtime — so we avoid handling the
service-role key directly. Anything on Vercel that truly needs it would be pasted by the owner
into the Vercel dashboard.

---

## 6. Data layer (Supabase Postgres)

- Extensions: `pgcrypto` (UUID/hash), `pg_trgm` + native FTS (global search), `citext` (emails).
  `pg_cron` deferred (reminders via Vercel Cron + Edge Function on Free).
- **8 namespaced schemas** (`core`, `documents`, `corporate`, `finance`, `research`,
  `commercialization`, `funding`, `administration`) ≈ 40+ tables.
- Conventions: UUID PKs; FKs + indexes + unique constraints; audit columns
  (`created_at/by`, `updated_at/by`, `deleted_at/by`, `row_version`, `status`, `organization_id`);
  `numeric` for money; UTC timestamps (display `America/New_York`).
- **Concurrency:** optimistic via `row_version` (reject stale writes).
- **RLS:** enabled + **deny-by-default** on every table; `USING` + `WITH CHECK`; gated on active
  membership + role permission + AAL2; cross-org denied; archived-record protection. Security-
  invoker views. Advisors (`get_advisors security|performance`) run after every migration.
- **Data API exposure:** business schemas are **not** blanket-exposed to PostgREST. Access is via
  (a) the Vercel data-gateway using the user JWT against RLS-protected tables/views, and (b)
  tightly-scoped RPC/security-invoker views. Grants minimized.
- **Storage:** private buckets, org-scoped non-guessable paths, Storage RLS, short-lived signed
  URLs, SHA-256 integrity, MIME/signature/size validation, dedupe without bypassing authz.

---

## 7. Shared frameworks (built once, reused by every module)

- **DataTables framework** — one config-driven initializer: server-side pagination/sort/filter/
  search (allow-listed columns, capped page size, parameterized), column visibility, status/
  category/date filters, row-action menu, bulk ops, archived toggle, responsive collapse,
  empty/loading states, accessible keyboard nav.
- **CRUD framework** — standard Add/Edit (modal/drawer/editor), FE+BE validation, optimistic
  concurrency, document attachment, soft-delete/restore, unsaved-change warnings, audit events.
- **Export framework** — server-side PDF / XLSX / CSV / DOCX honoring RLS + export scope (not just
  loaded rows), CSV formula-injection-safe, `export_history` + short-lived signed URLs, file
  hashes, retention expiry. **JS libraries** (PDF/XLSX/DOCX); Google Docs/Sheets integration-gated;
  **OCR / ReportLab / PyMuPDF deferred.**

---

## 8. Firewall & headers (Vercel Pro — rules available)

- Managed WAF on; **endpoint-specific rate limits** for auth / upload / export / API (staged in
  logging mode first where supported, then enforced). No static IP allowlists, no geo-blocks
  (mobile/cellular/dynamic-IP must work). Independent app-layer rate limiting as defense-in-depth.
- Headers via `vercel.json`: HSTS, **CSP (new, scoped to `/admin`)**, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, `frame-ancestors`, admin `Cache-Control: private, no-store`,
  `X-Robots-Tag: noindex, nofollow`. Marketing-site headers unchanged. Admin excluded from sitemap.

---

## 9. Delivery plan (full coverage; foundation-first so nothing lands half-built)

Each phase is independently shippable and **verified** (tests + advisors + a real login/flow on a
preview) before the next begins.

| Phase | Deliverable | Definition of done |
|---|---|---|
| **P0 Infra** | Extensions; `core` auth/RBAC + `audit_logs` schema + RLS; env vars wired; **Vercel build-from-repo transition** (+ `.vercelignore` revision, root `vercel.json`); `build.mjs` copies `src/admin/`; `middleware.ts` skeleton; **fix the failing `v2` build**; preview serves gated `/admin`. | Preview deploy green (marketing site identical); `/admin` 302→login when unauth; advisors clean. |
| **P1 Auth** | Invite-only + TOTP MFA + cookie sessions + owner bootstrap + CSRF + session mgmt; audit logging live. | Owner logs in with MFA **on a phone**; unauthorized/expired/revoked all rejected. |
| **P2 Core app** | DataTables + CRUD + Export frameworks; **Document Vault** (Storage+RLS+versions); dashboard shell (real data, explicit empty states). | A record can be Added/Edited/Archived/Restored/Exported with audit; a file uploads/downloads via signed URL. |
| **P3 Modules** | All record modules on the shared frameworks: corporate governance, finance (+cost centers), federal registrations, IP, research personnel, research programs (STRIX/C-Engine/AFIIS), commercialization, funding opportunities, funding applications (**incl. owner-provided NSF SBIR record**), awards, grant readiness, calendar/tasks/notifications, reports, settings, audit UI. | Every module: Add/View/Edit/Soft-Delete/Restore/Search/Filter/Sort/Paginate/Attach/Audit/Export(PDF,XLSX,CSV,DOCX). |
| **P4 Advanced** | Proposal editor (autosave, revisions, limits, approval); application package (ZIP + manifest + hashes + immutable snapshots); global FTS; reports center. | Build a package; edit+export a proposal; permission-aware search. |
| **P5 Integrations** | Google Workspace / GitHub / DocuSign / Resend / funding APIs — connect-ready, OAuth, graceful degrade. | Connect/disconnect/status; nothing auto-sends/submits; absent creds fail gracefully. |
| **P6 Hardening** | pytest + Playwright (auth, RLS, DataTables, exports, documents, mobile viewports); advisors; public-site regression; deploy prep + runbooks + README fix. | Tests pass; advisors clean; marketing site regression green; production-promotion runbook ready. |

**Deferred (explicitly):** heavy Python (OCR/ReportLab/PyMuPDF/python-docx server pipeline),
`pg_cron`, Supabase-Pro-dependent features — tracked in §10/§11.

---

## 10. Owner inputs needed (non-blocking; can arrive as we go)
- **Bootstrap owner email** for the first admin account (invited, not hardcoded).
- Confirmation that **Edge-Functions-only** handling of the service role is acceptable (so no
  service-role key is pasted anywhere), or provide it via the Vercel dashboard if preferred.
- For P5: Google / GitHub / DocuSign OAuth client credentials (when we reach integrations).

## 11. Supabase Free → production upgrade checklist (no billing changes without approval)
- **Pro** for: daily backups + PITR, **no 7-day auto-pause**, higher DB/storage quotas,
  custom SMTP (Resend) for Auth email at volume, more Edge Function invocations.
- Until then: Free is fine for build + preview; auth email is rate-limited (Resend SMTP mitigates);
  project may auto-pause if idle 7 days (restartable).

## 12. Blast radius & rollback
- All DB changes are version-controlled migrations on an isolated project; reversible.
- All app changes proven on previews; production is a reviewed `v2` merge + Vercel promotion;
  rollback = Vercel instant rollback to the prior good deployment (`dpl_9uTVQuUs…`, READY).
```
