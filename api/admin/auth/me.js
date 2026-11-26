import { serverClient } from '../../_lib/supabase.js';
import { json, requireMethod } from '../../_lib/http.js';

// GET /api/admin/auth/me — current identity (profile + memberships + permissions).
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: identity, error } = await supabase.rpc('me');
  if (error) return json(res, 500, { error: 'identity_failed' });

  return json(res, 200, {
    user: { id: user.id, email: user.email },
    aal: aal?.currentLevel || 'aal1',
    identity
  });
}
