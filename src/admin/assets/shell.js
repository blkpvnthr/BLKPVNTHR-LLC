/* Admin app shell: sidebar navigation + topbar (identity + sign out) + session
 * guard. Rendered on module pages (which provide #side, #topbar, #view). */
(function () {
  'use strict';
  // Nav hierarchy + built-slug set are generated at build time from
  // src/data/admin-modules.mjs into /admin/assets/modules.js.
  var DATA = window.__ADMIN_MODULES__ || { nav: [], built: [] };
  var NAV = DATA.nav || [];
  var BUILT = { '/admin/': 1 };
  (DATA.built || []).forEach(function (s) {
    BUILT['/admin/' + s] = 1;
  });

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs)
      for (var k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    (kids || []).forEach(function (c) {
      e.appendChild(c);
    });
    return e;
  }

  function renderSidebar(side) {
    var brand = el('div', { class: 'brand' }, [
      el('img', {
        src: '/assets/blkpvnthr-mark.png',
        alt: '',
        width: '28',
        height: '28',
        decoding: 'async'
      }),
      (function () {
        var s = el('span', { class: 'brand-name' });
        s.appendChild(document.createTextNode('BLKPVNTHR '));
        s.appendChild(el('span', { class: 'brand-suffix', text: 'LLC' }));
        return s;
      })()
    ]);
    side.appendChild(brand);
    var path = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    NAV.forEach(function (grp) {
      side.appendChild(el('p', { class: 'side-group', text: grp[0] }));
      grp[1].forEach(function (it) {
        var href = it[1] ? '/admin/' + it[1] : '/admin/';
        var active = href === path || (href !== '/admin/' && path.indexOf(href) === 0);
        if (BUILT[href]) {
          var a = el('a', {
            class: 'side-link' + (active ? ' active' : ''),
            href: href,
            text: it[0]
          });
          side.appendChild(a);
        } else {
          side.appendChild(
            el('span', { class: 'side-link disabled', title: 'Coming soon', text: it[0] })
          );
        }
      });
    });
  }

  async function guardAndRenderTopbar(topbar, title) {
    var me = await AdminAPI.get('/api/admin/auth/me');
    if (me.status !== 200) {
      window.location.href = '/admin/login';
      return null;
    }
    var left = el('strong', {
      class: 'topbar-title',
      text: title || document.title.replace(/ ·.*$/, '')
    });
    var ident = (me.data.user && me.data.user.email) || '';
    var mem =
      (me.data.identity && me.data.identity.memberships && me.data.identity.memberships[0]) || {};
    var who = el('span', { class: 'mono', text: ident + ' · ' + (mem.role || '') });
    who.style.cssText = 'font-size:.68rem;color:var(--ink-faint)';
    var out = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Sign out' });
    out.style.cssText = 'width:auto;padding:.45rem .9rem';
    out.addEventListener('click', async function () {
      await AdminAPI.post('/api/admin/auth/logout', {});
      window.location.href = '/admin/login';
    });
    var right = el('span', null, [who, out]);
    right.style.cssText = 'display:flex;align-items:center;gap:14px';
    topbar.appendChild(left);
    topbar.appendChild(right);
    return me.data;
  }

  window.AdminShell = {
    mount: async function (title) {
      var side = document.getElementById('side');
      var topbar = document.getElementById('topbar');
      if (side) renderSidebar(side);
      var me = topbar ? await guardAndRenderTopbar(topbar, title) : null;
      return me;
    }
  };
})();
