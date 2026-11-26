import { issueCsrf } from '../../_lib/csrf.js';
import { serializeCookie } from '../../_lib/cookies.js';
import { json, requireMethod } from '../../_lib/http.js';

// GET /api/admin/auth/csrf — issue a double-submit CSRF token (cookie + body).
export default function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const token = issueCsrf();
  res.setHeader(
    'Set-Cookie',
    serializeCookie('admin_csrf', token, { secure: true, sameSite: 'lax', path: '/', maxAge: 7200 })
  );
  json(res, 200, { token });
}
