/**
 * Pure (no Node built-ins) cookie parse/serialize — safe to import from both the
 * Node serverless functions and the Edge middleware runtime.
 */
export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function cookieList(header) {
  return Object.entries(parseCookies(header)).map(([name, value]) => ({ name, value }));
}

export function serializeCookie(name, value, options = {}) {
  const o = options;
  let str = `${name}=${encodeURIComponent(value)}`;
  if (o.maxAge != null) str += `; Max-Age=${Math.floor(o.maxAge)}`;
  if (o.expires) {
    const exp = o.expires instanceof Date ? o.expires.toUTCString() : o.expires;
    str += `; Expires=${exp}`;
  }
  str += `; Path=${o.path || '/'}`;
  if (o.domain) str += `; Domain=${o.domain}`;
  if (o.sameSite) {
    const s = String(o.sameSite);
    str += `; SameSite=${s.charAt(0).toUpperCase()}${s.slice(1)}`;
  }
  if (o.secure) str += '; Secure';
  if (o.httpOnly) str += '; HttpOnly';
  return str;
}
