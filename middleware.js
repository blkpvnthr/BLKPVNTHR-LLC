/**
 * Vercel Edge Middleware — server-side gate for the administrative portal.
 *
 * Runs before every /admin and /api/admin request. Public auth pages, admin
 * static assets, and the health check are allow-listed; everything else requires
 * a session, otherwise the request is redirected to the login page (pages) or
 * rejected with 401 (API).
 *
 * P0 note: this performs a session-cookie presence check only. Phase 1 replaces
 * it with full Supabase JWT verification + AAL2 (MFA) assurance + active-
 * membership lookup via @supabase/ssr. Returning nothing continues the request.
 */

const PUBLIC_BASES = new Set(['/admin/login', '/admin/mfa', '/admin/reset-password']);

function isPublic(pathname) {
  if (pathname === '/api/admin/health') return true;
  if (pathname.startsWith('/admin/assets/')) return true;
  const base = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/admin';
  return PUBLIC_BASES.has(base);
}

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isPublic(pathname)) return; // continue

  const cookie = request.headers.get('cookie') || '';
  const hasSession = /(?:^|;\s*)(sb-[A-Za-z0-9_-]+-auth-token|__admin_session)=/.test(cookie);

  if (!hasSession) {
    if (pathname.startsWith('/api/admin')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
      });
    }
    const login = new URL('/admin/login', request.url);
    login.searchParams.set('next', pathname);
    return Response.redirect(login, 302);
  }

  return; // session present — full verification lands in Phase 1
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*']
};
