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
     Hide the primary nav on scroll down, reveal it on scroll up

     Desktop only: below 1061px the nav is a toggle-driven disclosure panel,
     so the scroll effect (and its .is-hidden class) must not touch it.
     --------------------------------------------------------------------- */
  (function initHideNavOnScroll() {
    var header = document.querySelector('.site-header');
    var nav = document.getElementById('primary-nav');
    if (!header || !nav || prefersReducedMotion) return;

    var desktop = window.matchMedia('(min-width: 1061px)');
    var lastY = window.pageYOffset || 0;
    var ticking = false;
    // Ignore jitter and iOS rubber-band overscroll; only react to real intent.
    var DELTA = 6;

    function update() {
      ticking = false;
      var y = Math.max(0, window.pageYOffset || 0);
      var diff = y - lastY;

      if (Math.abs(diff) < DELTA) return;

      // Only manage the inline desktop nav; leave the mobile panel to the toggle.
      if (desktop.matches && diff > 0 && y > header.offsetHeight) {
        nav.classList.add('is-hidden');
      } else if (diff < 0 || y <= header.offsetHeight) {
        nav.classList.remove('is-hidden');
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

    // Dropping back to the mobile layout must clear any lingering hidden state.
    var onChange = function (event) {
      if (!event.matches) nav.classList.remove('is-hidden');
    };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  })();
})();
