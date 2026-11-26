import { serverClient } from '../../../_lib/supabase.js';
import { json, requireMethod } from '../../../_lib/http.js';
import { checkCsrf } from '../../../_lib/csrf.js';

// POST /api/admin/auth/mfa/enroll — begin TOTP enrollment (returns QR + secret).
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });

  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return json(res, 401, { error: 'unauthorized' });

  // Drop any stale unverified TOTP factor so re-enrollment is idempotent.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all || []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator'
  });
  if (error) {
    console.error('[mfa/enroll] enroll failed:', error.message);
    return json(res, 400, { error: 'enroll_failed' });
  }

  return json(res, 200, {
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri
  });
}
