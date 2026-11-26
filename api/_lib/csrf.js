/** CSRF double-submit tokens: HMAC-signed nonce, verified against the cookie. */
import crypto from 'node:crypto';
import { parseCookies } from './cookies.js';

const SECRET = process.env.ADMIN_CSRF_SECRET || '';

export function issueCsrf() {
  const nonce = crypto.randomBytes(18).toString('hex');
  const sig = crypto.createHmac('sha256', SECRET).update(nonce).digest('hex');
  return `${nonce}.${sig}`;
}

function validSignature(token) {
  if (typeof token !== 'string') return false;
  const [nonce, sig] = token.split('.');
  if (!nonce || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(nonce).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Require a valid CSRF token present in BOTH the header and the matching cookie. */
export function checkCsrf(req) {
  const header = req.headers['x-csrf-token'];
  const cookie = parseCookies(req.headers.cookie || '').admin_csrf;
  if (!header || !cookie) return false;
  if (header !== cookie) return false;
  return validSignature(header);
}
