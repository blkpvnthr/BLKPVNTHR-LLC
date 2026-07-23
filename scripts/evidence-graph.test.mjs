/**
 * Regression coverage for the Decision Evidence Graph initialization
 * (site/assets/main.js). The staged draw (.is-drawn) and the default emphasis
 * must run whether or not the .model-tabs tablist is present — the graph can
 * never render blank because the switcher is absent.
 *
 * Runs the ACTUAL main.js against a minimal DOM stub (no jsdom / zero deps):
 * every other module (nav, scroll-spy, reveal, header, previews) self-guards on
 * elements that the stub omits, so only initEvidenceGraph does meaningful work.
 *
 * Run: node --test scripts/evidence-graph.test.mjs   (also via `npm test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../site/assets/main.js'),
  'utf8'
);

function classList() {
  const s = new Set();
  return {
    add: (c) => s.add(c),
    remove: (c) => s.delete(c),
    toggle(c, f) {
      const on = f === undefined ? !s.has(c) : !!f;
      if (on) s.add(c);
      else s.delete(c);
      return on;
    },
    contains: (c) => s.has(c)
  };
}

function el(props = {}) {
  return {
    classList: classList(),
    dataset: {},
    _attrs: {},
    getAttribute(k) {
      return k in this._attrs ? this._attrs[k] : null;
    },
    setAttribute(k, v) {
      this._attrs[k] = String(v);
    },
    _on: {},
    addEventListener(type, fn) {
      (this._on[type] = this._on[type] || []).push(fn);
    },
    removeEventListener() {},
    focus() {},
    contains() {
      return false;
    },
    querySelectorAll() {
      return [];
    },
    appendChild() {},
    tabIndex: 0,
    id: '',
    ...props
  };
}

function makeEnv({ withTabs }) {
  const traces = ['evidence', 'analysis', 'review'];
  const series = traces.map((t) => el({ dataset: { series: t } }));
  const fills = traces.map((t) => el({ dataset: { fill: t } }));
  const dots = traces.map((t) => el({ dataset: { dots: t } }));
  const legend = traces.map((t) => el({ dataset: { legend: t } }));
  const panel = el({ id: 'graph-panel' });
  const model = el();

  let tabs = [];
  let tablist = null;
  if (withTabs) {
    tabs = traces.map((t, i) =>
      el({
        dataset: { trace: t },
        id: 'tab-' + t,
        _attrs: { 'aria-selected': i === 0 ? 'true' : 'false' }
      })
    );
    tablist = el({ querySelectorAll: (sel) => (sel.includes('role="tab"') ? tabs : []) });
  }

  const byAll = {
    '[data-series]': series,
    '[data-fill]': fills,
    '[data-dots]': dots,
    '[data-legend]': legend
  };
  const bySel = { '.model': model, '.model-tabs': tablist, '#graph-panel': panel };

  const document = {
    querySelector: (sel) => (sel in bySel ? bySel[sel] : null),
    querySelectorAll: (sel) => byAll[sel] || [],
    getElementById: (id) => (id === 'graph-panel' ? panel : null),
    createElement: () => el(),
    addEventListener() {},
    documentElement: el(),
    body: el(),
    activeElement: null
  };

  class IntersectionObserver {
    constructor(cb) {
      this.cb = cb;
    }
    observe(target) {
      this.cb([{ isIntersecting: true, target }]);
    }
    unobserve() {}
  }

  const window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    addEventListener() {},
    requestAnimationFrame: (fn) => fn(),
    pageYOffset: 0,
    IntersectionObserver
  };

  return { window, document, IntersectionObserver, model, series, tabs };
}

function run(env) {
  // main.js references bare globals: window, document, IntersectionObserver,
  // clearTimeout. Supply them as parameters (clearTimeout is a harmless no-op).
  const fn = new Function('window', 'document', 'IntersectionObserver', 'clearTimeout', SRC);
  fn(env.window, env.document, env.IntersectionObserver, () => {});
}

test('initializes and draws WITHOUT a tablist (coupling fix)', () => {
  const env = makeEnv({ withTabs: false });
  run(env);
  assert.ok(env.model.classList.contains('is-drawn'), 'staged draw must run without .model-tabs');
  const evidence = env.series.find((s) => s.dataset.series === 'evidence');
  assert.ok(evidence.classList.contains('is-active'), 'default trace emphasized without a tablist');
});

test('initializes, draws, and normalizes ARIA WITH a tablist', () => {
  const env = makeEnv({ withTabs: true });
  run(env);
  assert.ok(env.model.classList.contains('is-drawn'), 'staged draw must run');
  const evidenceTab = env.tabs.find((t) => t.dataset.trace === 'evidence');
  const analysisTab = env.tabs.find((t) => t.dataset.trace === 'analysis');
  assert.equal(evidenceTab.getAttribute('aria-selected'), 'true', 'active tab normalized');
  assert.equal(evidenceTab.tabIndex, 0, 'roving tabindex on the active tab');
  assert.equal(analysisTab.tabIndex, -1, 'inactive tab gets tabindex -1');
});

test('activating a non-default tab moves emphasis and roving tabindex', () => {
  const env = makeEnv({ withTabs: true });
  run(env);
  const evidenceTab = env.tabs.find((t) => t.dataset.trace === 'evidence');
  const analysisTab = env.tabs.find((t) => t.dataset.trace === 'analysis');
  // Simulate a click on the Analysis tab via the captured handler.
  (analysisTab._on.click || []).forEach((fn) => fn({}));
  assert.equal(analysisTab.getAttribute('aria-selected'), 'true', 'clicked tab becomes selected');
  assert.equal(analysisTab.tabIndex, 0, 'clicked tab gets tabindex 0');
  assert.equal(evidenceTab.tabIndex, -1, 'previously-active tab drops to tabindex -1');
  const analysisSeries = env.series.find((s) => s.dataset.series === 'analysis');
  const evidenceSeries = env.series.find((s) => s.dataset.series === 'evidence');
  assert.ok(analysisSeries.classList.contains('is-active'), 'analysis trace emphasized');
  assert.ok(!evidenceSeries.classList.contains('is-active'), 'evidence trace no longer emphasized');
});
