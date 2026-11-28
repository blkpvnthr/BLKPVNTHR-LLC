/**
 * GET /api/admin/export?resource=…&format=csv&q&archived&sort&dir&f_<col>=…
 * Streams the full authorized result set (RLS-scoped, not just the loaded page)
 * as a download. CSV is formula-injection-safe. Records an audit event.
 * (XLSX / PDF / DOCX formats are added in the export-framework phase.)
 */
import { serverClient } from '../_lib/supabase.js';
import { getResource } from '../_lib/resources.js';

const MAX_ROWS = 5000;

function csvCell(v) {
  if (v === null || v === undefined) return '';
  var s = Array.isArray(v) ? v.join('; ') : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula-injection guard
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }

  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    res.statusCode = 401;
    return res.end('unauthorized');
  }

  const url = new URL(req.url, 'http://local');
  const r = getResource(url.searchParams.get('resource'));
  if (!r) {
    res.statusCode = 404;
    return res.end('unknown_resource');
  }
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();

  let query = supabase.schema(r.schema).from(r.table).select(r.columns.join(','));
  query =
    url.searchParams.get('archived') === '1'
      ? query.not('deleted_at', 'is', null)
      : query.is('deleted_at', null);
  if (r.scope) for (const [col, val] of Object.entries(r.scope)) query = query.eq(col, val);
  for (const [k, v] of url.searchParams.entries()) {
    if (k.startsWith('f_')) {
      const col = k.slice(2);
      if (r.columns.includes(col) && v) query = query.eq(col, v);
    }
  }
  const q = (url.searchParams.get('q') || '').trim();
  if (q) {
    const safe = q.replace(/[,%()*]/g, ' ').trim();
    if (safe && r.searchable.length)
      query = query.or(r.searchable.map((c) => `${c}.ilike.%${safe}%`).join(','));
  }
  let sort = url.searchParams.get('sort');
  if (!sort || !r.sortable.includes(sort)) sort = r.defaultSort.col;
  query = query.order(sort, { ascending: url.searchParams.get('dir') === 'asc' }).limit(MAX_ROWS);

  const { data, error } = await query;
  if (error) {
    console.error('[export]', error.message);
    res.statusCode = 400;
    return res.end('export_failed');
  }

  if (format !== 'csv') {
    res.statusCode = 400;
    return res.end('unsupported_format');
  }

  const rows = data || [];
  const lines = [r.columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(r.columns.map((c) => csvCell(row[c])).join(','));
  const body = '﻿' + lines.join('\r\n'); // BOM for Excel UTF-8

  // Best-effort audit of the export (RLS-scoped insert by the acting user).
  try {
    await supabase
      .schema('administration')
      .from('audit_logs')
      .insert({
        organization_id: '0b1c0000-0000-0000-0000-000000000001',
        actor_user_id: user.id,
        event_type: 'export',
        entity_schema: r.schema,
        entity_table: r.table,
        after: { format: 'csv', rows: rows.length },
        outcome: 'success'
      });
  } catch (e) {
    /* non-fatal */
  }

  const fname = `${r.table}-${new Date().toISOString().slice(0, 10)}.csv`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}
