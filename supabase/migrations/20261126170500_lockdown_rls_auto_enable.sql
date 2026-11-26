-- Harden a pre-existing SECURITY DEFINER event-trigger function.
-- `public.rls_auto_enable()` (event trigger `ensure_rls`) auto-enables RLS on new
-- public tables — a useful safety net — but Postgres grants EXECUTE to PUBLIC by
-- default, which exposes it as a REST RPC (flagged by the security advisor).
-- Event triggers run as the function owner regardless of EXECUTE grants, so
-- revoking the grant removes the exposed surface without disabling the safety net.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
