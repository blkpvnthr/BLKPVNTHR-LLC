/**
 * GET /api/admin/health — liveness + env-wiring probe for the admin backend.
 * Public (allow-listed in middleware). Returns no secrets — only whether the
 * Supabase URL is configured, so the frontend can confirm the backend is live.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    service: 'blkpvnthr-admin',
    supabaseConfigured: Boolean(process.env.SUPABASE_URL),
    time: new Date().toISOString()
  });
}
