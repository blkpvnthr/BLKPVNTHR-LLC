/* BLKPVNTHR LLC Admin — client controller (Phase 1).
 * Drives the server-side auth flow: all credentials/codes are POSTed to
 * /api/admin/auth/*; no Supabase client runs in the browser and no tokens are
 * stored here — the session lives only in HTTP-only cookies the server sets. */
(function () {
  'use strict';
  var AUTH = '/api/admin/auth';
  var csrf = '';

  function qs(id) {
    return document.getElementById(id);
  }

  function notice(el, type, msg) {
    if (!el) return;
    el.hidden = false;
    el.className = 'notice notice-' + type;
    el.textContent = msg;
  }

  async function getCsrf() {
    var r = await fetch(AUTH + '/csrf', { credentials: 'same-origin' });
    var d = await r.json();
    csrf = d.token;
    return csrf;
  }

  async function post(path, body) {
    var r = await fetch(AUTH + path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(body || {})
    });
    var d = {};
    try {
      d = await r.json();
    } catch (e) {
      /* ignore */
    }
    return { status: r.status, data: d };
  }

  // ---- backend health pill ----
  function probe() {
    var el = qs('status');
    if (!el) return;
    fetch('/api/admin/health', { headers: { accept: 'application/json' } })
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject();
      })
      .then(function (d) {
        render(
          el,
          'ok',
          'Backend online · Supabase ' + (d.supabaseConfigured ? 'configured' : 'not configured')
        );
      })
      .catch(function () {
        render(el, 'bad', 'Backend unreachable');
      });
    function render(e, cls, label) {
      e.textContent = '';
      var dot = document.createElement('span');
      dot.className = 'dot ' + cls;
      var t = document.createElement('span');
      t.textContent = label;
      e.appendChild(dot);
      e.appendChild(t);
    }
  }

  // ---- login ----
  function initLogin() {
    var form = qs('login-form');
    if (!form) return;
    var msg = qs('login-notice');
    getCsrf();
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      var res = await post('/login', {
        email: qs('email').value.trim(),
        password: qs('password').value
      });
      if (res.status === 200 && res.data.ok) {
        if (res.data.next === 'dashboard') {
          window.location.href = '/admin/';
        } else {
          var step = res.data.next === 'mfa' ? 'challenge' : 'enroll';
          window.location.href = '/admin/mfa?step=' + step;
        }
        return;
      }
      btn.disabled = false;
      notice(
        msg,
        'err',
        res.status === 403
          ? 'Security check failed — reload the page and try again.'
          : 'Invalid email or password.'
      );
    });
  }

  // ---- MFA (enroll + challenge) ----
  function initMfa() {
    var root = qs('mfa-form');
    if (!root) return;
    var step = new URLSearchParams(window.location.search).get('step') || 'challenge';
    getCsrf().then(function () {
      if (step === 'enroll') startEnroll();
      else startChallenge(null);
    });
  }

  async function startEnroll() {
    qs('mfa-title').textContent = 'Set up two-factor authentication';
    qs('mfa-sub').textContent =
      'Scan the QR code with an authenticator app (e.g. Google Authenticator, 1Password, Authy), then enter the 6-digit code.';
    var box = qs('mfa-qr');
    var res = await post('/mfa/enroll', {});
    if (res.status !== 200) {
      notice(
        qs('mfa-notice'),
        'err',
        'Could not start enrollment. Return to sign in and try again.'
      );
      return;
    }
    box.textContent = '';
    var img = document.createElement('img');
    img.src = res.data.qr;
    img.alt = 'Authenticator QR code';
    img.width = 184;
    img.height = 184;
    box.appendChild(img);
    var sec = document.createElement('p');
    sec.className = 'mono';
    sec.style.cssText = 'font-size:11px;word-break:break-all;color:var(--ink-muted);margin:8px 0 0';
    sec.textContent = 'Secret: ' + res.data.secret;
    box.appendChild(sec);
    wireVerify(res.data.factorId);
  }

  function startChallenge(factorId) {
    qs('mfa-title').textContent = 'Two-factor verification';
    qs('mfa-sub').textContent = 'Enter the 6-digit code from your authenticator app.';
    wireVerify(factorId);
  }

  function wireVerify(factorId) {
    var form = qs('mfa-form');
    var btn = qs('mfa-submit');
    btn.disabled = false;
    form.onsubmit = async function (e) {
      e.preventDefault();
      btn.disabled = true;
      var code = qs('code').value.replace(/\s+/g, '');
      var vr = await post(
        '/mfa/verify',
        factorId ? { factorId: factorId, code: code } : { code: code }
      );
      if (vr.status === 200 && vr.data.ok) {
        window.location.href = '/admin/';
        return;
      }
      btn.disabled = false;
      notice(qs('mfa-notice'), 'err', 'Invalid code. Please try again.');
    };
  }

  // ---- dashboard ----
  async function initDashboard() {
    var root = qs('dash-root');
    if (!root) return;
    var r = await fetch(AUTH + '/me', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    });
    if (r.status !== 200) {
      window.location.href = '/admin/login';
      return;
    }
    var d = await r.json();
    var who = qs('dash-who');
    if (who) {
      var mem = (d.identity && d.identity.memberships && d.identity.memberships[0]) || {};
      who.textContent =
        (d.user.email || '') + ' · ' + (mem.role || 'no role') + ' · ' + (d.aal || '');
    }
    var out = qs('logout-btn');
    if (out) {
      await getCsrf();
      out.addEventListener('click', async function () {
        await post('/logout', {});
        window.location.href = '/admin/login';
      });
    }

    var pwForm = qs('pw-form');
    if (pwForm) {
      await getCsrf();
      pwForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var note = qs('pw-notice');
        var r = await post('/change-password', {
          currentPassword: qs('pw-current').value,
          newPassword: qs('pw-new').value
        });
        if (r.status === 200 && r.data.ok) {
          notice(note, 'info', 'Password updated.');
          pwForm.reset();
        } else {
          var m =
            r.data && r.data.error === 'wrong_current_password'
              ? 'Current password is incorrect.'
              : r.data && r.data.error === 'rate_limited'
                ? 'Too many attempts — wait a few minutes.'
                : 'Could not update password. Use at least 12 characters with mixed character types.';
          notice(note, 'err', m);
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    probe();
    initLogin();
    initMfa();
    initDashboard();
  });
})();
