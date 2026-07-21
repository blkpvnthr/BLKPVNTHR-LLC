/**
 * BLKPVNTHR LLC — corporate site behaviour.
 *
 * Four independent modules: mobile navigation, the illustrative scenario
 * model, scroll-spy for the primary nav, and a reveal-on-scroll effect.
 * Everything degrades gracefully: with JavaScript disabled the page is still
 * fully readable, the baseline scenario is shown, and all links work.
 */
(function () {
  'use strict';

  // The head script drops the .js reveal gate after 3s in case this file never
  // loads. It did load, so cancel that safety net.
  if (window.__revealFallback) clearTimeout(window.__revealFallback);

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     Mobile navigation
     --------------------------------------------------------------------- */
  (function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('primary-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      nav.classList.toggle('is-open', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Any in-page link closes the panel so the target is not hidden behind it.
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset state when the layout returns to the desktop breakpoint.
    // Must match the nav breakpoint in styles.css (max-width: 1060px).
    var desktop = window.matchMedia('(min-width: 1061px)');
    var onChange = function (event) {
      if (event.matches) setOpen(false);
    };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  })();

  /* ---------------------------------------------------------------------
     Illustrative scenario model

     All figures below are synthetic and exist to demonstrate the shape of a
     scenario-comparison interface. They are not derived from real program
     data and must never be presented as results.
     --------------------------------------------------------------------- */
  (function initScenarioModel() {
    var tablist = document.querySelector('.model-tabs');
    if (!tablist) return;

    var SCENARIOS = {
      baseline: {
        workforce: '+38%',
        workforceNote: 'peak, vs. 2026',
        cost: '$4.2B',
        costNote: 'net present value',
        capacity: '6.1 GW',
        capacityNote: '2040 projection',
        evidence: '84%',
        evidenceNote: 'inputs with provenance'
      },
      accelerated: {
        workforce: '+112%',
        workforceNote: 'peak, vs. 2026',
        cost: '$7.8B',
        costNote: 'net present value',
        capacity: '11.4 GW',
        capacityNote: '2040 projection',
        evidence: '71%',
        evidenceNote: 'inputs with provenance'
      },
      constrained: {
        workforce: '+14%',
        workforceNote: 'peak, vs. 2026',
        cost: '$3.1B',
        costNote: 'net present value',
        capacity: '3.7 GW',
        capacityNote: '2040 projection',
        evidence: '89%',
        evidenceNote: 'inputs with provenance'
      }
    };

    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    var panel = document.getElementById('scenario-panel');

    // Only write when the value actually changes. The four note strings are
    // identical across scenarios, and rewriting them would re-fire the live
    // region on every arrow key with nothing new to announce.
    function setMetric(name, value) {
      var node = document.querySelector('[data-metric="' + name + '"]');
      if (node && node.textContent !== value) node.textContent = value;
    }

    function select(scenario, focusTab) {
      var data = SCENARIOS[scenario];
      if (!data) return;

      tabs.forEach(function (tab) {
        var selected = tab.dataset.scenario === scenario;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) tab.focus();
        if (selected && panel) panel.setAttribute('aria-labelledby', tab.id);
      });

      document.querySelectorAll('[data-series]').forEach(function (path) {
        path.classList.toggle('is-active', path.dataset.series === scenario);
      });
      document.querySelectorAll('[data-fill]').forEach(function (path) {
        path.classList.toggle('is-active', path.dataset.fill === scenario);
      });
      document.querySelectorAll('[data-legend]').forEach(function (item) {
        item.classList.toggle('is-active', item.dataset.legend === scenario);
      });

      setMetric('workforce', data.workforce);
      setMetric('workforce-note', data.workforceNote);
      setMetric('cost', data.cost);
      setMetric('cost-note', data.costNote);
      setMetric('capacity', data.capacity);
      setMetric('capacity-note', data.capacityNote);
      setMetric('evidence', data.evidence);
      setMetric('evidence-note', data.evidenceNote);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        select(tab.dataset.scenario, false);
      });
    });

    // Standard WAI-ARIA tablist keyboard interaction.
    tablist.addEventListener('keydown', function (event) {
      var index = tabs.indexOf(document.activeElement);
      if (index === -1) return;

      var next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
        next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;

      if (next !== null) {
        event.preventDefault();
        select(tabs[next].dataset.scenario, true);
      }
    });
  })();

  /* ---------------------------------------------------------------------
     Scroll-spy for the primary navigation
     --------------------------------------------------------------------- */
  (function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var sections = links
      .map(function (link) {
        return document.querySelector(link.getAttribute('href'));
      })
      .filter(Boolean);
    if (!sections.length) return;

    var visible = new Set();
    var lastCurrent = null;

    function sync() {
      // Whichever tracked section sits highest on screen wins.
      var candidate = sections
        .filter(function (section) {
          return visible.has(section.id);
        })
        .sort(function (a, b) {
          return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
        })[0];

      // Sections without a nav link (#reactorcast) are never observed, so the
      // candidate list goes empty while one is on screen. Hold the last known
      // section instead of clearing, which would blank the whole nav.
      if (candidate) lastCurrent = candidate;
      var current = lastCurrent;

      links.forEach(function (link) {
        var isCurrent = Boolean(current) && link.getAttribute('href') === '#' + current.id;
        if (isCurrent) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        sync();
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  })();

  /* ---------------------------------------------------------------------
     Reveal on scroll — skipped entirely under reduced-motion
     --------------------------------------------------------------------- */
  (function initReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!targets.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (node) {
        node.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    targets.forEach(function (node) {
      observer.observe(node);
    });
  })();

  /* ---------------------------------------------------------------------
     Slide the whole header bar up on scroll down, reveal it on scroll up
     --------------------------------------------------------------------- */
  (function initHideOnScroll() {
    var header = document.querySelector('.site-header');
    if (!header || prefersReducedMotion) return;

    var nav = document.getElementById('primary-nav');
    var lastY = window.pageYOffset || 0;
    var ticking = false;
    // Ignore jitter and iOS rubber-band overscroll; only react to real intent.
    var DELTA = 6;

    function update() {
      ticking = false;
      var y = Math.max(0, window.pageYOffset || 0);
      var diff = y - lastY;

      if (Math.abs(diff) < DELTA) return;

      // Always show near the top, and never hide while the mobile menu is open
      // (the nav lives inside the header — sliding it away would trap the panel).
      var menuOpen = nav && nav.classList.contains('is-open');
      if (diff > 0 && y > header.offsetHeight && !menuOpen) {
        header.classList.add('is-hidden');
      } else if (diff < 0 || y <= header.offsetHeight) {
        header.classList.remove('is-hidden');
      }

      lastY = y;
    }

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
  })();

  /* ---------------------------------------------------------------------
     Product hover previews

     Each .has-preview card summons a mid-sized floating box that plays its
     preview (a looping GIF or muted looping video). The box is a single
     element appended to <body> so it escapes the products grid's
     `overflow: hidden` and the .reveal transform's containing block; it is
     positioned per-card with position: fixed and repositioned on scroll.
     Enabled only where a real hover pointer exists (skipped on touch).
     --------------------------------------------------------------------- */
  (function initProductPreviews() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.product.has-preview'));
    if (!cards.length) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    var GAP = 12; // px between the card edge and the box
    var box = document.createElement('div');
    box.className = 'product-preview';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);

    var active = null; // the card currently showing a preview
    var hideTimer = null;

    function buildMedia(card) {
      box.innerHTML = '';
      var type = card.getAttribute('data-preview-type');
      var src = card.getAttribute('data-preview-src');
      var media;
      if (type === 'video') {
        media = document.createElement('video');
        media.muted = true; // required for programmatic autoplay
        media.loop = true;
        media.playsInline = true;
        media.autoplay = true;
        media.preload = 'auto';
        var poster = card.getAttribute('data-preview-poster');
        if (poster) media.poster = poster;
        // WebM/VP9 first (every Chromium/Firefox decodes it), MP4/H.264 as the
        // Safari fallback — the browser picks the first source it can play.
        var webm = card.getAttribute('data-preview-src-webm');
        if (webm) {
          var webmSource = document.createElement('source');
          webmSource.src = webm;
          webmSource.type = 'video/webm';
          media.appendChild(webmSource);
        }
        var mp4Source = document.createElement('source');
        mp4Source.src = src;
        mp4Source.type = 'video/mp4';
        media.appendChild(mp4Source);
      } else {
        media = document.createElement('img');
        media.decoding = 'async';
        media.alt = '';
        media.src = src; // a fresh element restarts the GIF from frame one
      }
      media.className = 'product-preview-media';
      box.appendChild(media);
      if (type === 'video') {
        var p = media.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    }

    function position(card) {
      var r = card.getBoundingClientRect();
      var vw = document.documentElement.clientWidth;
      var vh = document.documentElement.clientHeight;
      var bw = box.offsetWidth;
      var bh = box.offsetHeight;

      // Prefer above the card; drop below if there is not enough headroom.
      var pointsDown = false;
      var top = r.top - bh - GAP;
      if (top < 8) {
        top = r.bottom + GAP;
        pointsDown = true;
      }
      // Last resort: if it also overflows the bottom, pin within the viewport.
      if (top + bh > vh - 8) top = Math.max(8, vh - bh - 8);
      box.classList.toggle('points-down', pointsDown);

      var centre = r.left + r.width / 2;
      var left = Math.min(Math.max(8, centre - bw / 2), vw - bw - 8);
      box.style.left = Math.round(left) + 'px';
      box.style.top = Math.round(top) + 'px';
      box.style.setProperty('--arrow-x', Math.round(centre - left) + 'px');
    }

    function show(card) {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      if (active === card) return;
      active = card;
      buildMedia(card);
      position(card); // measure with media laid out (aspect-ratio gives height)
      // A second pass next frame catches any late layout (e.g. scrollbar shift).
      window.requestAnimationFrame(function () {
        if (active === card) {
          position(card);
          box.classList.add('is-visible');
        }
      });
    }

    function hide(card) {
      if (active !== card) return;
      active = null;
      box.classList.remove('is-visible');
      // Clear media after the fade so network/CPU stops but no blank flash shows.
      hideTimer = setTimeout(function () {
        if (!active) box.innerHTML = '';
      }, 200);
    }

    cards.forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        show(card);
      });
      card.addEventListener('mouseleave', function () {
        hide(card);
      });
      // Keyboard parity: focusing the card's link reveals the preview too.
      card.addEventListener('focusin', function () {
        show(card);
      });
      card.addEventListener('focusout', function (event) {
        if (!card.contains(event.relatedTarget)) hide(card);
      });
    });

    // Keep the box glued to its card while scrolling; hide on resize to avoid
    // a stale rect (a hovered card is uncommon during a resize anyway).
    window.addEventListener(
      'scroll',
      function () {
        if (active) position(active);
      },
      { passive: true }
    );
    window.addEventListener('resize', function () {
      if (active) hide(active);
    });
  })();

  /* ---------------------------------------------------------------------
     Brain explainer lightbox

     Clicking (or activating via keyboard) any explainer still opens it
     full-screen in a shared overlay. The overlay is built once and appended
     to <body>; a click on the backdrop or close button, or Escape, dismisses
     it and returns focus to the still that opened it.
     --------------------------------------------------------------------- */
  (function initBrainLightbox() {
    var stills = Array.prototype.slice.call(
      document.querySelectorAll('.os-brain .card-media img[data-full]')
    );
    if (!stills.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.hidden = true;

    var full = document.createElement('img');
    full.className = 'lightbox-image';
    full.alt = '';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'lightbox-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '✕';

    overlay.appendChild(full);
    overlay.appendChild(close);
    document.body.appendChild(overlay);

    var opener = null;

    function open(still) {
      opener = still;
      full.src = still.getAttribute('data-full');
      full.alt = still.getAttribute('alt') || '';
      overlay.setAttribute('aria-label', full.alt || 'Enlarged image');
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      // Commit the hidden state (display/opacity) with a forced reflow so the
      // fade runs from it — rAF would stall on a backgrounded tab. Focus only
      // after .is-open, since a visibility:hidden node can't hold focus.
      void overlay.offsetWidth;
      overlay.classList.add('is-open');
      close.focus();
    }

    function dismiss() {
      if (overlay.hidden) return;
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      var restore = opener;
      opener = null;
      var finish = function () {
        overlay.hidden = true;
        full.removeAttribute('src');
        overlay.removeEventListener('transitionend', finish);
      };
      if (prefersReducedMotion) finish();
      else overlay.addEventListener('transitionend', finish);
      if (restore) restore.focus();
    }

    stills.forEach(function (still) {
      // Promote each still to a keyboard-operable control (no-JS users just see
      // the static image, so these semantics are added here rather than in HTML).
      still.setAttribute('role', 'button');
      still.setAttribute('tabindex', '0');
      var label = still.getAttribute('alt');
      if (label) still.setAttribute('aria-label', 'Enlarge: ' + label);

      still.addEventListener('click', function () {
        open(still);
      });
      still.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(still);
        }
      });
    });

    // A click anywhere on the overlay (backdrop or the image) closes it; the
    // image is contain-fit with dead space around it, so this reads naturally.
    overlay.addEventListener('click', dismiss);
    close.addEventListener('click', function (event) {
      event.stopPropagation();
      dismiss();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') dismiss();
    });
  })();
})();
