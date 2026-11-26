/**
 * Allow-listed data resources for the generic gateway + export endpoints, built
 * from the shared module registry (src/data/admin-modules.mjs). RLS enforces row
 * authorization; this registry bounds which tables/columns are reachable and
 * which columns may be sorted / searched / written.
 */
import { MODULES } from '../../src/data/admin-modules.mjs';

function buildRegistry() {
  const R = {};
  for (const m of MODULES) {
    const fields = m.columns.map((c) => c.key);
    R[`${m.schema}.${m.table}`] = {
      schema: m.schema,
      table: m.table,
      read: m.read,
      write: m.write,
      columns: [...fields, 'status', 'created_at', 'updated_at', 'row_version', 'id'],
      writable: fields,
      searchable: m.columns.filter((c) => c.searchable).map((c) => c.key),
      sortable: [
        'created_at',
        'updated_at',
        ...m.columns.filter((c) => c.sortable).map((c) => c.key)
      ],
      defaultSort: { col: 'created_at', dir: 'desc' }
    };
  }
  return R;
}

export const RESOURCES = buildRegistry();

export function getResource(key) {
  return Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : null;
}
