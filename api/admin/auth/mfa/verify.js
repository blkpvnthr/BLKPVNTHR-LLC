import { serverClient } from '../../../_lib/supabase.js';
import { readJson, json, requireMethod } from '../../../_lib/http.js';
import { checkCsrf } from '../../../_lib/csrf.js';

// POST /api/admin/auth/mfa/verify — verify a TOTP code, upgrading the session to AAL2.
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });

  const { factorId, challengeId, code } = await readJson(req);
  if (!factorId || !challengeId || !code) return json(res, 400, { error: 'missing_fields' });

  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code: String(code).replace(/\s+/g, '')
  });
  if (error) return json(res, 400, { error: 'invalid_code', detail: error.message });

  return json(res, 200, { ok: true, next: 'dashboard' });
}
