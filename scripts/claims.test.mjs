/**
 * Regression coverage for the claim-safety rules (scripts/claims.mjs):
 *   - the four removed synthetic figures ($4.2B / 6.1 GW / +38% / 84%) can never
 *     return in their retired forms or structure;
 *   - unrelated legitimate percentages and numbers are NOT blocked.
 *
 * Run: node --test scripts/claims.test.mjs   (also via `npm test`).
 * This file lives outside site/, so the validator never scans it — the literal
 * synthetic values below are fixtures, not published copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClaimViolations } from './claims.mjs';

const labels = (raw, isHtml) => findClaimViolations(raw, isHtml).map((v) => v.label);
const blocks = (raw, isHtml, re) => labels(raw, isHtml).some((l) => re.test(l));

test('prevents the four removed synthetic figures in their retired forms', () => {
  // $4.2B and 6.1 GW — unique tokens, blocked anywhere (case/space tolerant).
  assert.ok(blocks('<dd class="metric-value">$4.2B</dd>', true, /synthetic model figure/), '$4.2B');
  assert.ok(blocks('lifecycle cost $4.2b', false, /synthetic model figure/), '$4.2b lowercase');
  assert.ok(blocks('<dd>6.1 GW</dd>', true, /synthetic model figure/), '6.1 GW');
  assert.ok(blocks('capacity 6.1gw outlook', false, /synthetic model figure/), '6.1gw no-space');

  // +38% / 84% — blocked only beside their retired CONTEXT (label or note).
  assert.ok(
    blocks(
      '<dt>Workforce demand</dt><dd data-metric="workforce">+38%</dd>',
      true,
      /scenario percentage/
    ),
    '+38% beside "Workforce demand"'
  );
  assert.ok(
    blocks('<dt>Evidence coverage</dt><dd>84%</dd>', true, /scenario percentage/),
    '84% beside "Evidence coverage"'
  );

  // The retired SCENARIOS / metric-readout structure itself.
  assert.ok(
    blocks("workforceNote: 'peak, vs. 2026'", false, /scenario-metric structure/),
    'note string "peak, vs. 2026"'
  );
  assert.ok(
    blocks("evidenceNote: 'inputs with provenance'", false, /scenario-metric structure/),
    'note string "inputs with provenance"'
  );
  assert.ok(
    blocks(
      "document.querySelector('[data-metric=\"' + name + '\"]')",
      false,
      /scenario-metric structure/
    ),
    'data-metric readout wiring'
  );

  // Field-name evasion: a SCENARIOS-shaped object with only keys + % values.
  assert.ok(
    blocks("const S = { workforce: '+38%', evidence: '84%' }", false, /scenario-metric structure/),
    'JS object keyed by retired field name'
  );
  // Hyphen separator variant of the capacity figure.
  assert.ok(
    blocks('capacity 6.1-GW outlook', false, /synthetic model figure/),
    '6.1-GW hyphenated'
  );
});

test('allows unrelated legitimate percentages and numbers', () => {
  const legit = [
    ['<p>Test coverage reached 84% this quarter.</p>', true], // 84% without the retired context
    ['<p>Latency improved +38% year over year.</p>', true], // +38% without the retired context
    ['<p>Evidence coverage reached 92% of inputs.</p>', true], // retired phrase, different number
    ['<p>Error rate fell to 0.84%.</p>', true], // decimal must not hit 84%
    ['<p>Throughput up 184% since launch.</p>', true], // 184% must not hit 84%
    ['<p>Budget of $4.2 billion over ten years.</p>', true], // spelled out, not the $4.2B token
    ['<p>Grid capacity of 6.1 GWh stored.</p>', true], // GWh, not the GW token
    ['<p>A $1.2M seed round.</p>', true], // unrelated currency
    ['const cfg = { evidence: true, workforce: 12 };', false], // retired keys, no % value
    ['<p>Workforce planning and evidence review.</p>', true] // retired words, no percentage
  ];
  for (const [html, isHtml] of legit) {
    assert.deepEqual(findClaimViolations(html, isHtml), [], `should allow: ${html}`);
  }
});

test('still enforces the pre-existing claim-safety rules', () => {
  assert.ok(blocks('We are award-winning and industry-leading.', true, /award|superlative/i));
  assert.deepEqual(
    findClaimViolations('BLKPVNTHR LLC builds analytical software for decision systems.', true),
    []
  );
});
