import { serverClient } from '../../../_lib/supabase.js';
import { readJson, json, requireMethod } from '../../../_lib/http.js';
import { checkCsrf } from '../../../_lib/csrf.js';

// POST /api/admin/auth/mfa/verify — verify a TOTP code, upgrading the session to AAL2.
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });

  const body = await readJson(req);
  const code = String(body.code || '').replace(/\s+/g, '');
  if (!code) return json(res, 400, { error: 'missing_code' });

  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return json(res, 401, { error: 'unauthorized' });

  // Resolve the factor: the one being enrolled (passed in) or the user's TOTP factor.
  let factorId = body.factorId;
  if (!factorId) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp =
      (factors?.all || []).find((f) => f.factor_type === 'totp' && f.status === 'verified') ||
      (factors?.all || []).find((f) => f.factor_type === 'totp') ||
      (factors?.totp || [])[0];
    factorId = totp?.id;
  }
  if (!factorId) return json(res, 400, { error: 'no_factor' });

  // Challenge + verify in the SAME request so both originate from one IP.
  // Supabase rejects an MFA verify whose challenge came from a different IP,
  // which is exactly what separate serverless invocations would produce.
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) {
    console.error('[mfa/verify] challenge failed:', chErr.message);
    return json(res, 400, { error: 'verification_failed' });
  }

  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
  if (error) {
    console.error('[mfa/verify] verify failed:', error.message);
    return json(res, 400, { error: 'invalid_code' });
  }

  return json(res, 200, { ok: true, next: 'dashboard' });
}
