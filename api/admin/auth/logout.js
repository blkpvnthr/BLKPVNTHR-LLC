import { serverClient } from '../../_lib/supabase.js';
import { json, requireMethod } from '../../_lib/http.js';
import { checkCsrf } from '../../_lib/csrf.js';

// POST /api/admin/auth/logout — revoke the session and clear cookies.
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });
  const supabase = serverClient(req, res);
  await supabase.auth.signOut();
  return json(res, 200, { ok: true });
}
