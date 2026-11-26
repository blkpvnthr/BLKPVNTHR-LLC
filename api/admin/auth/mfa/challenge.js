import { serverClient } from '../../../_lib/supabase.js';
import { readJson, json, requireMethod } from '../../../_lib/http.js';
import { checkCsrf } from '../../../_lib/csrf.js';

// POST /api/admin/auth/mfa/challenge — create a challenge for a TOTP factor.
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });

  const body = await readJson(req);

  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return json(res, 401, { error: 'unauthorized' });

  // Use the provided factor, else the user's verified TOTP factor.
  let factorId = body.factorId;
  if (!factorId) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp =
      (factors?.all || []).find((f) => f.factor_type === 'totp' && f.status === 'verified') ||
      (factors?.totp || [])[0];
    factorId = totp?.id;
  }
  if (!factorId) return json(res, 400, { error: 'no_factor' });

  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) return json(res, 400, { error: error.message });
  return json(res, 200, { challengeId: data.id, factorId });
}
