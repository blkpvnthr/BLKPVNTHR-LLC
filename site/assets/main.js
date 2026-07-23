/**
 * BLKPVNTHR LLC — corporate site behaviour.
 *
 * Independent modules: mobile navigation, the Decision Evidence Trace reveal,
 * scroll-spy for the primary nav, a reveal-on-scroll effect, a hide-on-scroll
 * header, and product hover previews. Everything degrades gracefully: with
 * JavaScript disabled the page is fully readable, the trace shows its complete
 * static diagram, and all links work.
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
     Decision Evidence Trace

     A conceptual, non-quantitative diagram in the hero. CSS renders the
     complete static diagram by default; adding .is-traced plays a short,
     one-shot staged reveal (source -> analysis -> decision -> traceability).
     Under reduced motion, or without IntersectionObserver, the class is added
     immediately and the CSS reveal is a no-op — the diagram is simply shown.
     --------------------------------------------------------------------- */
  (function initEvidenceTrace() {
    var trace = document.querySelector('.trace');
    if (!trace) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      trace.classList.add('is-traced');
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-traced');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.25 }
    );

    observer.observe(trace);
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
})();
