import { createClient } from '@supabase/supabase-js';
import { serverClient } from '../../_lib/supabase.js';
import { readJson, json, requireMethod, clientIp } from '../../_lib/http.js';
import { checkCsrf } from '../../_lib/csrf.js';

// POST /api/admin/auth/change-password — change the signed-in user's password.
// Requires an AAL2 (MFA) session, CSRF, and the correct current password.
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });

  const { currentPassword, newPassword } = await readJson(req);
  if (!currentPassword || !newPassword) return json(res, 400, { error: 'missing_fields' });

  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return json(res, 401, { error: 'unauthorized' });

  // Sensitive op: require MFA assurance.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') return json(res, 403, { error: 'mfa_required' });

  // Rate limit: 5 attempts / IP / 5 min.
  const { data: allowed } = await supabase.rpc('rl_hit', {
    p_bucket: 'pwchange:' + clientIp(req),
    p_limit: 5,
    p_window_secs: 300
  });
  if (allowed === false) return json(res, 429, { error: 'rate_limited' });

  // Verify the current password using an ephemeral client (no cookie side effects).
  const verifier = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error: vErr } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: String(currentPassword)
  });
  if (vErr) return json(res, 400, { error: 'wrong_current_password' });

  const { error } = await supabase.auth.updateUser({ password: String(newPassword) });
  if (error) {
    console.error('[change-password]', error.message);
    return json(res, 400, { error: 'password_update_failed' });
  }
  return json(res, 200, { ok: true });
}
