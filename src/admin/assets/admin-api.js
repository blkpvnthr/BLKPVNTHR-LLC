/* Shared admin client helpers: CSRF-aware fetch wrappers. */
window.AdminAPI = (function () {
  'use strict';
  var csrf = '';
  async function getCsrf() {
    if (csrf) return csrf;
    const r = await fetch('/api/admin/auth/csrf', { credentials: 'same-origin' });
    const d = await r.json();
    csrf = d.token;
    return csrf;
  }
  async function get(path) {
    const r = await fetch(path, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    });
    let d = null;
    try {
      d = await r.json();
    } catch (e) {
      /* non-json */
    }
    return { status: r.status, data: d };
  }
  async function post(path, body) {
    await getCsrf();
    const r = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(body || {})
    });
    let d = null;
    try {
      d = await r.json();
    } catch (e) {
      /* non-json */
    }
    return { status: r.status, data: d };
  }
  return { getCsrf: getCsrf, get: get, post: post };
})();
