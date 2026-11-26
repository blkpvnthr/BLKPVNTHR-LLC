# Vercel Firewall — configuration & limitation

## Status
- **Automatic DDoS mitigation:** always-on at the Vercel platform level (no config needed).
- **Managed WAF (OWASP CRS) + custom rate-limit rules:** prepared below, **not yet applied** —
  the Vercel MCP connector's OAuth scope returns `403 forbidden` for
  `PUT /v1/security/firewall/config` ("permission to update the firewall config"), and the
  `vercel` CLI is blocked in the build sandbox. This is a **connector-permission limitation, not a
  plan limitation** (the team is on Pro, which supports custom rules + rate limiting).
- **Application-layer rate limiting:** IMPLEMENTED as the sanctioned fallback —
  `public.rl_hit()` + `administration.rate_limits`, enforced on `login` and `mfa/verify`
  (10 attempts / IP / minute → HTTP 429). This protects the brute-force surface regardless of the WAF.

## To apply the managed WAF + per-endpoint WAF rate limits (owner, one step)
Run from a shell with your Vercel login (full permissions), using the committed config file:

```bash
vercel api "/v1/security/firewall/config?projectId=prj_bdHf9tOsBUtOFZ13AryQAKStMNf1&teamId=team_bEhxT0ft24LJAlBR67zfkS8W" \
  --method PUT --input docs/admin/firewall-config.json
```

Alternatively, re-authorize the Vercel connector with firewall write scope and I can apply it directly.

## What the config does
- **Managed OWASP CRS**: `sqli, xss, lfi, rfi, rce, php, java, ma, sf` → **deny**; `gen, sd` → **log**
  (broad heuristics start in log mode to avoid false positives on legitimate admin traffic; promote
  to deny after reviewing logs).
- **Rate-limit rules** (per IP, fixed 60s window, ordered specific-first):
  - `/api/admin/auth/*` → 20/min
  - `/api/admin/documents/upload*` → 30/min
  - `/api/admin/exports*` → 20/min
  - `/api/admin/*` → 120/min
- **No** static IP allowlists, **no** geographic restrictions, **no** mandatory VPN — mobile devices
  on cellular/Wi-Fi with dynamic IPv4/IPv6 are unaffected.

## Mobile-safety note
Rate limits key on client IP. A single administrator on mobile will not approach these limits.
Large carrier-grade NAT pools could aggregate unrelated users behind one IP; the limits above are
set high enough that this is not a concern for the current single-org, few-user deployment. Revisit
if the user base grows.
