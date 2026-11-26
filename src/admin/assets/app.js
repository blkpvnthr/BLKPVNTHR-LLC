/* BLKPVNTHR LLC Admin — P0 bootstrap.
 * Reports backend health and wires the auth-page shells. Real credential +
 * MFA sign-in is provisioned in Phase 1; this file intentionally performs no
 * authentication yet and stores nothing in the browser. */
(function () {
  'use strict';
  var ENV = window.__ADMIN_ENV__ || {};

  function setStatus(ok, label) {
    var el = document.getElementById('status');
    if (!el) return;
    el.textContent = '';
    var dot = document.createElement('span');
    dot.className = 'dot ' + (ok ? 'ok' : 'bad');
    var txt = document.createElement('span');
    txt.textContent = label;
    el.appendChild(dot);
    el.appendChild(txt);
  }

  // Health probe — proves the serverless backend + env wiring are live.
  function probe() {
    setStatus(false, 'Checking backend…');
    fetch('/api/admin/health', { headers: { accept: 'application/json' } })
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject(r.status);
      })
      .then(function (d) {
        setStatus(
          true,
          'Backend online · Supabase ' + (d.supabaseConfigured ? 'configured' : 'not configured')
        );
      })
      .catch(function () {
        setStatus(false, 'Backend unreachable');
      });
  }

  function wireLogin() {
    var form = document.getElementById('login-form');
    if (!form) return;
    var notice = document.getElementById('login-notice');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (notice) {
        notice.hidden = false;
        notice.className = 'notice notice-info';
        notice.textContent =
          'Secure sign-in (email + mandatory MFA) is being provisioned in Phase 1. ' +
          'The backend, database, and access controls are already live.';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    probe();
    wireLogin();
  });
})();
