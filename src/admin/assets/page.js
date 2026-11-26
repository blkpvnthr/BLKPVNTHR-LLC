/* Module page bootstrap: reads the page's JSON table-config, mounts the app
 * shell (nav + topbar + session guard), then initializes the DataTable.
 * Keeps module pages free of inline scripts (CSP script-src 'self'). */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async function () {
    var cfgEl = document.getElementById('table-config');
    if (!cfgEl) return;
    var cfg;
    try {
      cfg = JSON.parse(cfgEl.textContent);
    } catch (e) {
      return;
    }
    if (window.AdminShell) await window.AdminShell.mount(cfg.title);
    if (window.AdminTable) window.AdminTable.init(cfg);
  });
})();
