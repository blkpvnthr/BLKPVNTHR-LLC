# BLKPVNTHR LLC Admin Portal — Pre-Cutover Validation Report

**Date:** 2026-11-26 · **Environment:** SSO-protected Vercel preview (branch `worktree-admin`,
commit `4592472`) · **Supabase:** `gbaepwxbatrctxoyeysm` (BLKPVNTHR-LLC, us-east-1) ·
**Production (`blkpvnthr.com/admin`): NOT deployed — awaiting owner approval.**

Automated evidence: consolidated suite **19/19 pass**, storage suite **10/10 pass**, RLS
assertion suite **pass**, full mobile browser flow **pass**, marketing build **byte-identical**.

---

## 1. Requirement-by-requirement

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Supabase Auth operational | ✅ Done | Login/MFA/session verified end-to-end (19/19). |
| 2 | Admin sign-in + **mandatory MFA** | ✅ Done | Password → TOTP enroll/challenge → AAL2; AAL1 `/admin` is redirected to `/admin/mfa`; middleware requires AAL2. |
| 3 | Public registration disabled | ✅ Done | `/auth/v1/signup` → `422 signup_disabled`; settings `disable_signup:true`, anon off, all social off. |
| 4 | Initial owner securely configured | ✅ Done (owner action pending) | `contact@blkpvnthr.com` = owner, active membership; enrolls own MFA on first login; **must change temp password** (mechanism shipped — see §4). |
| 5 | Server-side session verification on all routes/APIs | ✅ Done | Edge middleware: `getUser()` + AAL2 + active-membership on `/admin/*` and `/api/admin/*`; HTTP-only/Secure/SameSite cookies via `@supabase/ssr`; no tokens in the browser. |
| 6 | Supabase RLS implemented **and tested** | ✅ Done | Deny-by-default on every table; `supabase/tests/rls_test.sql` passes: non-member isolation, self-escalation blocked, MFA-gated writes, anon lockdown. Security advisor clean of unintended findings. |
| 7 | Vercel Firewall | ⚠️ Partial (app-layer done; WAF prepared) | DDoS = always-on. App-layer rate limiting live (login + MFA-verify + password-change → `429`). Managed WAF + per-endpoint WAF limits prepared in `docs/admin/firewall-config.json`; **connector OAuth scope can't write firewall config (403)** → one owner command applies it (see §5). |
| 8 | Private Storage access controls | ✅ Done | Private `documents` bucket; Storage RLS (org path + role + MFA); short-lived signed URLs; `supabase/tests/storage_test.mjs` 10/10: AAL1/anon/cross-org denied, signed URL works, direct API cannot bypass. |
| 9 | Mobile accessibility | ✅ Done (emulated) | Playwright iPhone 390×844 + Android 393×851: full login→MFA enroll→AAL2→dashboard→session-persist→logout; no horizontal overflow; responsive forms. **Physical-device + real cellular testing is owner-side (see §6).** |
| 10 | Public website unaffected | ✅ Done | Marketing root byte-identical (same ETag as live); admin-scoped CSP/headers do not touch marketing; claim-safety + private-file CI gates intact. |
| 11 | Production builds pass tests | ✅ Done | `npm test` (format + validate + unit) 6/6; build-from-repo preview `READY` (this also fixed the previously-failing `v2` builds). |

---

## 2. Test results

- **Consolidated auth/session/password/rate-limit suite — 19/19** (login, CSRF enforcement, MFA
  enforcement + enroll/verify→AAL2, identity/role, gated access, password change incl.
  wrong-current rejection + new-accepted/old-rejected, rate-limit burst → `429`).
- **Storage RLS — 10/10** (AAL1 upload denied, AAL2 own-org upload allowed, cross-org denied,
  signed URL issued + downloads, anon download denied).
- **Database RLS assertions — pass** (`rls_test.sql`).
- **Mobile browser (emulated)** — full iPhone flow + Android render, no overflow.
- **Unit/CI** — 6/6; preview build green; marketing byte-identical.

## 3. Security findings

- **Resolved during build:** MFA "challenge/verify IP mismatch" (merged into one request);
  information-disclosure on MFA errors (generic errors, server-side logging); rate-limit key
  spoofing via `x-forwarded-for` (now prefers Vercel's trusted `x-real-ip`); an accidentally
  committed Playwright snapshot containing a **TOTP secret for now-deleted QA accounts** (defunct)
  — purged from the feature-branch history and force-pushed.
- **Advisors — intentional/by-design:** `rl_hit` is anon-executable SECURITY DEFINER (required for
  pre-auth rate limiting; only increments a counter, exposes no data); `administration.rate_limits`
  is RLS-enabled with no policy (deliberate deny-all; reached only via `rl_hit`).
- **Advisor — recommended (not blocking):** leaked-password protection (HaveIBeenPwned) is off;
  not exposed in `config.toml` → enable in the Supabase dashboard (may be plan-gated). Password
  policy already enforces ≥12 chars + mixed classes.
- **Secrets:** none in tracked source. Secrets live only in Vercel env / Supabase runtime. The
  Supabase publishable key (client-safe by design) appears in a committed test file — acceptable.

## 4. Remaining blockers (before production cutover)

1. **Owner changes the temporary password.** Mechanism shipped: sign in → enroll MFA → Dashboard →
   "Change password" card (requires AAL2 + current password). Temp password is in the session
   scratchpad (`owner_pw.txt`), retrievable with `! cat`.
2. **Owner approval of the production cutover** (merge `worktree-admin` → `v2`). Recommended as a
   **squash-merge**, then delete the feature branch.
3. *(Recommended, not blocking)* Apply the managed Vercel WAF (§5).

## 5. Infrastructure limitations

- **Vercel WAF (connector scope):** MCP connector lacks firewall-config write (`403`). Not a plan
  limit (team is Pro). Apply with your credentials:
  `vercel api "/v1/security/firewall/config?projectId=prj_bdHf9tOsBUtOFZ13AryQAKStMNf1&teamId=team_bEhxT0ft24LJAlBR67zfkS8W" --method PUT --input docs/admin/firewall-config.json`
  (or re-authorize the connector with firewall scope). App-layer rate limiting covers the interim.
- **Supabase Free plan:** no daily backups / PITR; 7-day inactivity auto-pause; Auth email
  rate-limited (wire Resend SMTP for invites/recovery at volume); `[auth.sessions]` timeouts and
  Advanced MFA-phone are Pro-only. Session timeout is enforced app-side (1h JWT + edge re-check).
- **Password recovery (forgot-password):** not yet implemented — `reset-password.html` is a shell;
  a self-service recovery flow needs Resend SMTP + a token-exchange page. Authenticated password
  change IS implemented. (Deferred; not a cutover blocker since the owner can sign in + change.)
- **README.md** still describes the legacy Oracle-VM deploy — stale; to be corrected.

## 6. Mobile testing — scope

Performed with **browser-emulated** iPhone/Android viewports over normal networking (no static IP,
no VPN). **Not performed (owner-side):** real physical devices and live cellular-data networks.
The architecture imposes no IP/geo/VPN restrictions, so cellular/Wi-Fi dynamic IPv4/IPv6 are
expected to work; a quick real-device smoke test is recommended before go-live.

## 7. Production deployment readiness

**READY for cutover pending:** (1) owner changes the temp password, (2) explicit owner approval.
On approval the cutover is: merge `worktree-admin` → `v2` (squash) → Vercel auto-builds production →
`https://blkpvnthr.com/admin/` live (gated), marketing unchanged. Rollback = Vercel instant
rollback to the prior production deployment. No production promotion will occur without approval.
