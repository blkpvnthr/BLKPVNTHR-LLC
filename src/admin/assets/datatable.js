/* Reusable admin DataTable + CRUD framework.
 * AdminTable.init(config) renders a server-side-paged table with search, filters,
 * sortable columns, an archived toggle, Add/View/Edit/Archive/Restore actions,
 * and CSV export — all against the generic /api/admin/data gateway. Every record
 * module is a thin page that supplies a config; no module re-implements CRUD. */
(function () {
  'use strict';
  var API = '/api/admin/data';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs)
      for (var k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k === 'html') {
          /* never */
        } else e.setAttribute(k, attrs[k]);
      }
    (kids || []).forEach(function (c) {
      if (c) e.appendChild(c);
    });
    return e;
  }
  function fmt(v, type) {
    if (v === null || v === undefined || v === '') return '—';
    if (type === 'date') return String(v).slice(0, 10);
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (type === 'datetime') return String(v).replace('T', ' ').slice(0, 16);
    return String(v);
  }

  window.AdminTable = {
    init: function (cfg) {
      var mount = document.getElementById('view');
      var state = {
        page: 1,
        pageSize: 25,
        sort: null,
        dir: 'desc',
        q: '',
        archived: false,
        filters: {}
      };
      var tableCols = cfg.columns.filter(function (c) {
        return c.table;
      });

      var root = el('div');
      var head = el('div', { class: 'page-head' }, [
        el('h1', { text: cfg.title }),
        cfg.subtitle ? el('p', { class: 'muted', text: cfg.subtitle }) : null
      ]);
      var notice = el('p', { class: 'notice', hidden: 'hidden' });
      var toolbar = el('div', { class: 'dt-toolbar' });
      var tableWrap = el('div', { class: 'dt-wrap' });
      var pager = el('div', { class: 'dt-pager' });
      root.appendChild(head);
      root.appendChild(notice);
      root.appendChild(toolbar);
      root.appendChild(tableWrap);
      root.appendChild(pager);
      mount.replaceChildren();
      mount.appendChild(root);

      function msg(type, text) {
        notice.hidden = false;
        notice.className = 'notice notice-' + type;
        notice.textContent = text;
        setTimeout(function () {
          notice.hidden = true;
        }, 4000);
      }

      // ---- toolbar ----
      var addBtn = el('button', { class: 'btn btn-primary', text: '+ Add new' });
      addBtn.style.cssText = 'width:auto;padding:.5rem 1rem';
      addBtn.addEventListener('click', function () {
        openForm('create');
      });
      var exportBtn = el('button', { class: 'btn btn-secondary', text: 'Export CSV' });
      exportBtn.style.cssText = 'width:auto;padding:.5rem 1rem';
      exportBtn.addEventListener('click', exportCsv);
      var refreshBtn = el('button', { class: 'btn btn-secondary', text: 'Refresh' });
      refreshBtn.style.cssText = 'width:auto;padding:.5rem 1rem';
      refreshBtn.addEventListener('click', load);
      var search = el('input', { type: 'search', placeholder: 'Search…', class: 'dt-search' });
      var st;
      search.addEventListener('input', function () {
        clearTimeout(st);
        st = setTimeout(function () {
          state.q = search.value.trim();
          state.page = 1;
          load();
        }, 300);
      });
      var archivedLbl = el('label', { class: 'dt-check' });
      var archivedBox = el('input', { type: 'checkbox' });
      archivedBox.addEventListener('change', function () {
        state.archived = archivedBox.checked;
        state.page = 1;
        load();
      });
      archivedLbl.appendChild(archivedBox);
      archivedLbl.appendChild(document.createTextNode(' Show archived'));
      toolbar.appendChild(addBtn);
      toolbar.appendChild(exportBtn);
      toolbar.appendChild(refreshBtn);
      toolbar.appendChild(search);
      (cfg.filters || []).forEach(function (f) {
        var col = cfg.columns.filter(function (c) {
          return c.key === f.key;
        })[0];
        var sel = el('select', { class: 'dt-filter' });
        sel.appendChild(el('option', { value: '', text: f.label + ': all' }));
        ((col && col.options) || []).forEach(function (o) {
          sel.appendChild(el('option', { value: o, text: o }));
        });
        sel.addEventListener('change', function () {
          if (sel.value) state.filters[f.key] = sel.value;
          else delete state.filters[f.key];
          state.page = 1;
          load();
        });
        toolbar.appendChild(sel);
      });
      toolbar.appendChild(archivedLbl);

      // ---- data ----
      function qs() {
        var p = new URLSearchParams({
          resource: cfg.resource,
          action: 'list',
          page: state.page,
          pageSize: state.pageSize,
          dir: state.dir,
          archived: state.archived ? '1' : '0'
        });
        if (state.sort) p.set('sort', state.sort);
        if (state.q) p.set('q', state.q);
        Object.keys(state.filters).forEach(function (k) {
          p.set('f_' + k, state.filters[k]);
        });
        return p.toString();
      }
      async function load() {
        tableWrap.replaceChildren();
        tableWrap.appendChild(el('p', { class: 'muted', text: 'Loading…' }));
        var r = await AdminAPI.get(API + '?' + qs());
        if (r.status !== 200) {
          tableWrap.replaceChildren();
          tableWrap.appendChild(
            el('p', { class: 'muted', text: 'Could not load records (' + r.status + ').' })
          );
          return;
        }
        render(r.data);
      }
      function render(d) {
        tableWrap.replaceChildren();
        if (!d.rows.length) {
          tableWrap.appendChild(
            el('p', {
              class: 'muted',
              text: state.archived
                ? 'No archived records.'
                : 'No records yet. Use “Add new” to create one.'
            })
          );
          pager.textContent = '';
          return;
        }
        var tbl = el('table', { class: 'dt-table' });
        var thead = el('thead');
        var htr = el('tr');
        tableCols.forEach(function (c) {
          var th = el('th', { text: c.label });
          if (c.sortable !== false) {
            th.classList.add('sortable');
            if (state.sort === c.key) th.classList.add(state.dir === 'asc' ? 'asc' : 'desc');
            th.addEventListener('click', function () {
              if (state.sort === c.key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
              else {
                state.sort = c.key;
                state.dir = 'asc';
              }
              load();
            });
          }
          htr.appendChild(th);
        });
        htr.appendChild(el('th', { text: 'Actions' }));
        thead.appendChild(htr);
        tbl.appendChild(thead);
        var tb = el('tbody');
        d.rows.forEach(function (row) {
          var tr = el('tr');
          tableCols.forEach(function (c) {
            tr.appendChild(el('td', { text: fmt(row[c.key], c.type) }));
          });
          var act = el('td', { class: 'dt-actions' });
          act.appendChild(
            mkAction('View', function () {
              openView(row);
            })
          );
          if (!state.archived) {
            act.appendChild(
              mkAction('Edit', function () {
                openForm('update', row);
              })
            );
            act.appendChild(
              mkAction('Archive', function () {
                doArchiveRestore('archive', row);
              })
            );
          } else {
            act.appendChild(
              mkAction('Restore', function () {
                doArchiveRestore('restore', row);
              })
            );
          }
          tr.appendChild(act);
          tb.appendChild(tr);
        });
        tbl.appendChild(tb);
        tableWrap.appendChild(tbl);
        // pager
        pager.replaceChildren();
        var start = (d.page - 1) * d.pageSize + 1,
          end = Math.min(d.total, d.page * d.pageSize);
        pager.appendChild(
          el('span', { class: 'muted mono', text: start + '–' + end + ' of ' + d.total })
        );
        var prev = el('button', { class: 'btn btn-secondary', text: 'Prev' });
        prev.style.cssText = 'width:auto;padding:.35rem .8rem';
        prev.disabled = d.page <= 1;
        prev.addEventListener('click', function () {
          state.page--;
          load();
        });
        var next = el('button', { class: 'btn btn-secondary', text: 'Next' });
        next.style.cssText = 'width:auto;padding:.35rem .8rem';
        next.disabled = end >= d.total;
        next.addEventListener('click', function () {
          state.page++;
          load();
        });
        pager.appendChild(prev);
        pager.appendChild(next);
      }
      function mkAction(label, fn) {
        var a = el('button', { class: 'dt-act', text: label });
        a.addEventListener('click', fn);
        return a;
      }

      // ---- modals ----
      function overlay(node) {
        var ov = el('div', { class: 'dt-overlay' });
        ov.addEventListener('click', function (e) {
          if (e.target === ov) document.body.removeChild(ov);
        });
        ov.appendChild(node);
        document.body.appendChild(ov);
        return function () {
          if (ov.parentNode) document.body.removeChild(ov);
        };
      }
      function openView(row) {
        var box = el('div', { class: 'dt-modal' });
        box.appendChild(el('h2', { text: 'Record detail' }));
        var dl = el('dl', { class: 'dt-detail' });
        cfg.columns.forEach(function (c) {
          dl.appendChild(el('dt', { text: c.label }));
          dl.appendChild(el('dd', { text: fmt(row[c.key], c.type) }));
        });
        dl.appendChild(el('dt', { text: 'Status' }));
        dl.appendChild(el('dd', { text: row.status }));
        dl.appendChild(el('dt', { text: 'Updated' }));
        dl.appendChild(el('dd', { text: fmt(row.updated_at, 'datetime') }));
        box.appendChild(dl);
        var close = el('button', { class: 'btn btn-secondary', text: 'Close' });
        close.style.cssText = 'width:auto;padding:.5rem 1rem';
        var dispose = overlay(box);
        close.addEventListener('click', dispose);
        box.appendChild(close);
      }
      function openForm(mode, row) {
        row = row || {};
        var box = el('div', { class: 'dt-modal' });
        box.appendChild(el('h2', { text: (mode === 'create' ? 'Add — ' : 'Edit — ') + cfg.title }));
        var form = el('form');
        var inputs = {};
        cfg.columns.forEach(function (c) {
          var field = el('div', { class: 'field' });
          field.appendChild(
            el('label', { text: c.label + (c.required ? ' *' : ''), for: 'f_' + c.key })
          );
          var inp;
          if (c.type === 'textarea') {
            inp = el('textarea', { id: 'f_' + c.key, rows: '3' });
            inp.value = row[c.key] || '';
          } else if (c.type === 'select') {
            inp = el('select', { id: 'f_' + c.key });
            if (!c.required) inp.appendChild(el('option', { value: '', text: '—' }));
            (c.options || []).forEach(function (o) {
              var op = el('option', { value: o, text: o });
              if (row[c.key] === o) op.setAttribute('selected', 'selected');
              inp.appendChild(op);
            });
          } else {
            inp = el('input', {
              id: 'f_' + c.key,
              type: c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'
            });
            inp.value =
              c.type === 'date' ? fmtDate(row[c.key]) : row[c.key] == null ? '' : row[c.key];
            if (c.type === 'number') inp.step = 'any';
          }
          if (c.required) inp.setAttribute('required', 'required');
          inputs[c.key] = inp;
          field.appendChild(inp);
          form.appendChild(field);
        });
        var fnotice = el('p', { class: 'notice', hidden: 'hidden' });
        var save = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Save' });
        save.style.cssText = 'width:auto;padding:.55rem 1.2rem';
        var cancel = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Cancel' });
        cancel.style.cssText = 'width:auto;padding:.55rem 1.2rem;margin-left:8px';
        var actions = el('div', { class: 'dt-form-actions' }, [save, cancel]);
        form.appendChild(fnotice);
        form.appendChild(actions);
        box.appendChild(form);
        var dispose = overlay(box);
        cancel.addEventListener('click', dispose);
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          save.disabled = true;
          var values = {};
          cfg.columns.forEach(function (c) {
            var v = inputs[c.key].value;
            if (c.type === 'number' && v === '') v = null;
            values[c.key] = v;
          });
          var payload = { resource: cfg.resource, action: mode, values: values };
          if (mode === 'update') {
            payload.id = row.id;
            payload.rowVersion = row.row_version;
          }
          var r = await AdminAPI.post(API, payload);
          save.disabled = false;
          if (r.status === 200) {
            dispose();
            msg('info', mode === 'create' ? 'Record created.' : 'Record updated.');
            load();
          } else if (r.status === 409) {
            fnotice.hidden = false;
            fnotice.className = 'notice notice-warn';
            fnotice.textContent =
              'This record changed since you opened it. Close and reopen to edit the latest version.';
          } else {
            fnotice.hidden = false;
            fnotice.className = 'notice notice-err';
            fnotice.textContent = 'Save failed — check required fields and permissions.';
          }
        });
      }
      function fmtDate(v) {
        return v ? String(v).slice(0, 10) : '';
      }
      async function doArchiveRestore(action, row) {
        if (
          !window.confirm(
            action === 'archive'
              ? 'Archive this record? It will be hidden from normal views but preserved.'
              : 'Restore this record?'
          )
        )
          return;
        var r = await AdminAPI.post(API, {
          resource: cfg.resource,
          action: action,
          id: row.id,
          rowVersion: row.row_version
        });
        if (r.status === 200) {
          msg('info', action === 'archive' ? 'Record archived.' : 'Record restored.');
          load();
        } else if (r.status === 409) msg('warn', 'Record changed — refresh and retry.');
        else msg('err', action + ' failed.');
      }
      function exportCsv() {
        var p = new URLSearchParams({
          resource: cfg.resource,
          format: 'csv',
          dir: state.dir,
          archived: state.archived ? '1' : '0'
        });
        if (state.sort) p.set('sort', state.sort);
        if (state.q) p.set('q', state.q);
        Object.keys(state.filters).forEach(function (k) {
          p.set('f_' + k, state.filters[k]);
        });
        window.location = '/api/admin/export?' + p.toString();
      }

      load();
    }
  };
})();
