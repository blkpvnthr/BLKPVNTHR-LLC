/**
 * Generic data gateway for every record module.
 *   GET  /api/admin/data?resource=…&action=list&page&pageSize&sort&dir&q&archived&f_<col>=…
 *   POST /api/admin/data  { resource, action: create|update|archive|restore, id?, rowVersion?, values? }
 * Runs as the authenticated user (RLS enforced). The registry bounds which
 * resources/columns are reachable; the audit + concurrency triggers do the rest.
 */
import { serverClient } from '../_lib/supabase.js';
import { readJson, json } from '../_lib/http.js';
import { checkCsrf } from '../_lib/csrf.js';
import { getResource } from '../_lib/resources.js';

const ORG = '0b1c0000-0000-0000-0000-000000000001';
const MAX_PAGE = 100;

function pick(obj, keys) {
  const o = {};
  for (const k of keys) if (obj[k] !== undefined) o[k] = obj[k] === '' ? null : obj[k];
  return o;
}

export default async function handler(req, res) {
  const supabase = serverClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return json(res, 401, { error: 'unauthorized' });

  if (req.method === 'GET') return list(req, res, supabase);
  if (req.method === 'POST') {
    if (!checkCsrf(req)) return json(res, 403, { error: 'csrf_failed' });
    return mutate(req, res, supabase, user);
  }
  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method_not_allowed' });
}

async function list(req, res, supabase) {
  const url = new URL(req.url, 'http://local');
  const r = getResource(url.searchParams.get('resource'));
  if (!r) return json(res, 404, { error: 'unknown_resource' });

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(url.searchParams.get('pageSize') || '25', 10) || 25)
  );
  const archived = url.searchParams.get('archived') === '1';
  let sort = url.searchParams.get('sort') || r.defaultSort.col;
  if (!r.sortable.includes(sort)) sort = r.defaultSort.col;
  const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const q = (url.searchParams.get('q') || '').trim();

  let query = supabase
    .schema(r.schema)
    .from(r.table)
    .select(r.columns.join(','), { count: 'exact' });
  query = archived ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

  for (const [k, v] of url.searchParams.entries()) {
    if (k.startsWith('f_')) {
      const col = k.slice(2);
      if (r.columns.includes(col) && v) query = query.eq(col, v);
    }
  }
  if (q) {
    const safe = q.replace(/[,%()*]/g, ' ').trim();
    if (safe && r.searchable.length) {
      query = query.or(r.searchable.map((c) => `${c}.ilike.%${safe}%`).join(','));
    }
  }
  query = query.order(sort, { ascending: dir === 'asc' });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[data.list]', error.message);
    return json(res, 400, { error: 'query_failed' });
  }
  return json(res, 200, { rows: data || [], total: count || 0, page, pageSize });
}

async function mutate(req, res, supabase, user) {
  const body = await readJson(req);
  const r = getResource(body.resource);
  if (!r) return json(res, 404, { error: 'unknown_resource' });

  if (body.action === 'create') {
    const row = pick(body.values || {}, r.writable);
    row.organization_id = ORG;
    const { data, error } = await supabase
      .schema(r.schema)
      .from(r.table)
      .insert(row)
      .select(r.columns.join(','))
      .single();
    if (error) {
      console.error('[data.create]', error.message);
      return json(res, 400, { error: 'create_failed' });
    }
    return json(res, 200, { row: data });
  }

  if (body.action === 'update') {
    if (!body.id || body.rowVersion == null)
      return json(res, 400, { error: 'missing_id_or_version' });
    const row = pick(body.values || {}, r.writable);
    const { data, error } = await supabase
      .schema(r.schema)
      .from(r.table)
      .update(row)
      .eq('id', body.id)
      .eq('row_version', body.rowVersion)
      .select(r.columns.join(','))
      .maybeSingle();
    if (error) {
      console.error('[data.update]', error.message);
      return json(res, 400, { error: 'update_failed' });
    }
    if (!data) return json(res, 409, { error: 'conflict' });
    return json(res, 200, { row: data });
  }

  if (body.action === 'archive' || body.action === 'restore') {
    if (!body.id) return json(res, 400, { error: 'missing_id' });
    const patch =
      body.action === 'archive'
        ? { deleted_at: new Date().toISOString(), deleted_by: user.id, status: 'archived' }
        : { deleted_at: null, deleted_by: null, status: 'active' };
    let upd = supabase.schema(r.schema).from(r.table).update(patch).eq('id', body.id);
    if (body.rowVersion != null) upd = upd.eq('row_version', body.rowVersion);
    const { data, error } = await upd.select('id').maybeSingle();
    if (error) {
      console.error('[data.' + body.action + ']', error.message);
      return json(res, 400, { error: body.action + '_failed' });
    }
    if (!data) return json(res, 409, { error: 'conflict' });
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { error: 'unknown_action' });
}
