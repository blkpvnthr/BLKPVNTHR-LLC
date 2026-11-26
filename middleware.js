/**
 * Vercel Edge Middleware — server-side gate for the administrative portal.
 *
 * Runs before every /admin and /api/admin request. Allow-listed: public auth
 * pages, admin static assets, the health check, and the /api/admin/auth/*
 * endpoints (which self-guard). Everything else requires:
 *   1. a valid Supabase session (getUser() — validated against the Auth server),
 *   2. AAL2 assurance (mandatory MFA), and
 *   3. an active organization membership.
 * Unmet → redirect to login/MFA (pages) or 401 (API). Refreshed session cookies
 * are persisted on the continuing response.
 */
import { createServerClient } from '@supabase/ssr';
import { next } from '@vercel/edge';
import { cookieList, serializeCookie } from './api/_lib/cookies.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
const PUBLIC_BASES = new Set(['/admin/login', '/admin/mfa', '/admin/reset-password']);

function isPublic(pathname) {
  if (pathname === '/api/admin/health') return true;
  if (pathname.startsWith('/admin/assets/')) return true;
  if (pathname.startsWith('/api/admin/auth/')) return true; // self-guarding auth endpoints
  const base = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/admin';
  return PUBLIC_BASES.has(base);
}

function redirect(request, to) {
  const url = new URL(to, request.url);
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), 'Cache-Control': 'no-store' }
  });
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);
  if (isPublic(pathname)) return;

  const isApi = pathname.startsWith('/api/admin');
  const setCookies = [];

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieList(request.headers.get('cookie') || '');
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookies.push(serializeCookie(name, value, { ...options, ...COOKIE_OPTS }));
        }
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return isApi
      ? unauthorized()
      : redirect(request, '/admin/login?next=' + encodeURIComponent(pathname));

  // Mandatory MFA (AAL2).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.currentLevel !== 'aal2') {
    return isApi ? unauthorized() : redirect(request, '/admin/mfa');
  }

  // Active organization membership.
  const { data: me, error: meErr } = await supabase.rpc('me');
  const active =
    !meErr &&
    me &&
    Array.isArray(me.memberships) &&
    me.memberships.some((m) => m.status === 'active');
  if (!active) return isApi ? unauthorized() : redirect(request, '/admin/login?e=no_access');

  const headers = new Headers();
  for (const c of setCookies) headers.append('Set-Cookie', c);
  return next({ headers });
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*']
};
