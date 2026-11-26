/**
 * Server-side Supabase client for the Node serverless functions, backed by
 * @supabase/ssr with HTTP-only / Secure / SameSite cookies. Tokens are never
 * exposed to the browser or localStorage — they live only in these cookies.
 */
import { createServerClient } from '@supabase/ssr';
import { cookieList, serializeCookie } from './cookies.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

// Forced on every auth cookie regardless of library defaults.
const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

export function serverClient(req, res) {
  const accumulated = [];
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieList(req.headers.cookie || '');
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          accumulated.push(serializeCookie(name, value, { ...options, ...COOKIE_OPTS }));
        }
        res.setHeader('Set-Cookie', accumulated.slice());
      }
    }
  });
}
