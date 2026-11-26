// Supabase Edge Function: bootstrap-owner
//
// Creates (or re-provisions) an administrative account and its active membership.
// Invitation-only onboarding: this is the ONLY path that mints an admin account,
// and it runs server-side with the service role (injected into the function
// runtime — never exposed to the browser or the repo). It self-guards with a
// shared BOOTSTRAP_SECRET header, so it is safe to deploy with verify_jwt = false.
//
// POST { email, role?, setPassword? }  (header: x-bootstrap-secret)
import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function strongPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let raw = '';
  for (const b of bytes) raw += b.toString(16).padStart(2, '0');
  // Guarantee the configured complexity (lower, upper, digit, symbol).
  return `Aa1!${raw}`.slice(0, 28);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const secret = req.headers.get('x-bootstrap-secret');
  if (!secret || secret !== Deno.env.get('BOOTSTRAP_SECRET')) {
    return json(401, { error: 'unauthorized' });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = String(body.role ?? 'owner');
  const setPassword = body.setPassword !== false;
  if (!email) return json(400, { error: 'missing_email' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Find existing user by email.
  let userId: string | null = null;
  let temporaryPassword: string | null = null;
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return json(500, { error: 'list_failed', detail: listErr.message });
  const existing = listed?.users?.find((u) => (u.email ?? '').toLowerCase() === email);

  if (existing) {
    userId = existing.id;
    if (setPassword) {
      temporaryPassword = strongPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        email_confirm: true
      });
      if (error) return json(500, { error: 'update_failed', detail: error.message });
    }
  } else {
    temporaryPassword = strongPassword();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: temporaryPassword
    });
    if (error || !created?.user) return json(500, { error: 'create_failed', detail: error?.message });
    userId = created.user.id;
    if (!setPassword) temporaryPassword = null;
  }

  // Profile + active membership (via the service-role-only SECURITY DEFINER RPC).
  const { error: rpcErr } = await admin.rpc('bootstrap_owner', {
    p_user_id: userId,
    p_email: email,
    p_role: role
  });
  if (rpcErr) return json(500, { error: 'membership_failed', detail: rpcErr.message });

  return json(200, { ok: true, userId, email, role, temporaryPassword });
});
