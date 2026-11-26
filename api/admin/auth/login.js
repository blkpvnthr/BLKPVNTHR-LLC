import { serverClient } from '../../_lib/supabase.js';
import { readJson, json, requireMethod } from '../../_lib/http.js';
import { checkCsrf } from '../../_lib/csrf.js';

// POST /api/admin/auth/login — password sign-in (step 1 of 2; MFA follows).
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });

  const { email, password } = await readJson(req);
  if (!email || !password) return json(res, 400, { error: 'missing_credentials' });

  const supabase = serverClient(req, res);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password: String(password)
  });
  if (error) return json(res, 401, { error: 'invalid_credentials' });

  // Decide the next step from the authenticator assurance level.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  let next = 'enroll'; // aal1/aal1: no factor yet — MFA is mandatory, so enroll.
  if (aal?.currentLevel === 'aal2') next = 'dashboard';
  else if (aal?.nextLevel === 'aal2') next = 'mfa'; // has a factor, needs a challenge.
  return json(res, 200, { ok: true, next });
}
