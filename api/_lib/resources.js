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
    // A module's resource key is `m.resource` when set, else schema.table. This
    // lets several modules (e.g. research initiatives) share one table under
    // distinct keys, each narrowed by a fixed `scope` (col → value). Scope is
    // enforced server-side: filtered on read/export, injected on create, and
    // matched on update/archive so a scoped module can never touch another's rows.
    const key = m.resource || `${m.schema}.${m.table}`;
    R[key] = {
      schema: m.schema,
      table: m.table,
      read: m.read,
      write: m.write,
      scope: m.scope || null,
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
