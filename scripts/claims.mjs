/**
 * Claim-safety rules for the BLKPVNTHR LLC site — shared by scripts/validate.mjs
 * and its regression suite (scripts/claims.test.mjs). Dependency-free.
 *
 * Each rule blocks a category of claim the company cannot substantiate. `allow`
 * exempts explicit negations ("has not licensed", "is not affiliated with"),
 * which are required copy rather than violations.
 */

/** Strip comments and script/style bodies so checks do not match commentary. */
export function stripInert(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

/**
 * The text a claim rule sees: HTML has comments + script/style removed and tags
 * flattened to spaces (so an attribute never reads as body copy and a tag never
 * splits a phrase's words); JavaScript and other sources are matched raw.
 */
export function claimText(raw, isHtml) {
  return isHtml ? stripInert(raw).replace(/<[^>]*>/g, ' ') : raw;
}

export const CLAIM_RULES = [
  {
    label: 'implies ReactorCast is licensed or owned',
    re: /\b(we|blkpvnthr(?:\s+llc)?)\s+(?:have|has)\s+licen[sc]ed\b|\bour\s+reactorcast\b|\breactorcast\s+is\s+(?:our|a\s+blkpvnthr)\b/gi
  },
  {
    label: 'implies LANL/DOE partnership or endorsement',
    re: /\b(partner(?:ed|ship)?|affiliat(?:ed|ion)|endorse[ds]?|in\s+collaboration)\b[^.]{0,60}\b(los\s+alamos|lanl|department\s+of\s+energy|\bdoe\b)\b/gi,
    allow: /\bnot\s+(?:affiliated|endorsed)\b|\bno\s+affiliation\b/i
  },
  {
    label: 'asserts customers, clients, or deployments the company does not have',
    re: /\b(our|existing|current)\s+(customers|clients)\b|\btrusted\s+by\b|\bused\s+by\s+(?:leading|hundreds|thousands)\b|\b(?:customers|organizations)\s+(?:worldwide|across\s+the)\b/gi
  },
  {
    label: 'asserts a certification, clearance, or authorization not held',
    re: /\b(?:soc\s*2|iso\s*27001|fedramp|cmmc|nist\s*800-171)\s*(?:compliant|certified|certification|authorized)\b|\bsecurity\s+clearance\b|\bauthority\s+to\s+operate\b|\bclassified\s+(?:system|environment)\s+deployment/gi,
    allow: /\bdoes\s+not\s+(?:hold|claim)\b/i
  },
  {
    label: 'asserts an award, rating, or testimonial',
    re: /\baward-winning\b|\bindustry-leading\b|\brated\s+#?1\b|\bbest-in-class\b/gi
  },
  {
    label: 'implies NASA or APL endorsement rather than prior employment experience',
    re: /\b(?:nasa|johns\s+hopkins|applied\s+physics\s+laboratory|apl)\b[^.]{0,40}\b(?:partner|endorse[ds]?|client|customer)\b/gi
  },
  {
    label: 'startup hype / unsupported superlative',
    re: /\brevolutioniz\w*\b|\bgame[- ]changing\b|\bcutting[- ]edge\b|\bworld[- ]class\b|\bdisrupt(?:ing|ive)\b/gi
  },

  /* -- Retired synthetic scenario model (the +38% / $4.2B / 6.1 GW / 84% grid) -- */
  {
    // Two figures unique enough to ban outright with no legitimate collision;
    // case-insensitive and separator-tolerant (space or hyphen) so '$4.2b' /
    // '6.1gw' / '6.1-GW' cannot evade. Spelled-out forms ('$4.2 billion') are
    // deliberately NOT matched — that is a different, plausibly-legitimate token.
    label: 'restores a former synthetic model figure ($4.2B / 6.1 GW)',
    re: /\$4\.2[\s-]*b\b|\b6\.1[\s-]*gw\b/gi
  },
  {
    // The two PERCENTAGES (+38% workforce, 84% evidence coverage) are matched
    // ONLY beside their retired context — the metric label or note string — so
    // unrelated legitimate percentages (0.84%, a real +38% stat, or "evidence
    // coverage 92%") never fail. Window <=60 non-period chars; 84% carries a
    // (?<![\d.]) lookbehind so decimals like 0.84% never match even in-context.
    label: 'restores a former synthetic scenario percentage (+38% / 84% in context)',
    re: /(?:workforce\s+demand|evidence\s+coverage|peak,?\s*vs\.?\s*2026|inputs\s+with\s+provenance)[^.]{0,60}(?:\+38\s*%|(?<![\d.])84\s*%)|(?:\+38\s*%|(?<![\d.])84\s*%)[^.]{0,60}(?:workforce\s+demand|evidence\s+coverage|peak,?\s*vs\.?\s*2026|inputs\s+with\s+provenance)/gi
  },
  {
    // The retired synthetic-metric STRUCTURE itself — the data-metric readout
    // wiring, the SCENARIOS object shape (retired keys assigned a % value, e.g.
    // `workforce: '+38%'` / `evidence: '84%'`), and the distinctive note strings
    // — so the metric grid / SCENARIOS object cannot return in any form. The
    // key:value clause closes the field-name evasion the percentage-context rule
    // misses. 'net present value' is intentionally omitted (legitimate finance
    // term); data-metric only fires on raw JS (HTML tags flatten before match,
    // where the visible labels/notes carry the signal instead).
    label: 'restores the synthetic scenario-metric structure',
    re: /\bdata-metric\s*=|\b(?:workforce|evidence)\s*:\s*['"]?(?:\+38|84)\s*%|\bpeak,?\s*vs\.?\s*2026\b|\binputs\s+with\s+provenance\b|\b2040\s+projection\b/gi
  }
];

/**
 * Every claim-rule violation in one source, as [{ label, match }]. `raw` is the
 * file's unmodified contents; `isHtml` selects the HTML preprocessing.
 */
export function findClaimViolations(raw, isHtml) {
  const text = claimText(raw, isHtml);
  const hits = [];
  for (const rule of CLAIM_RULES) {
    for (const m of text.matchAll(rule.re)) {
      const window = text.slice(Math.max(0, m.index - 90), m.index + m[0].length + 90);
      if (rule.allow && rule.allow.test(window)) continue;
      hits.push({ label: rule.label, match: m[0].replace(/\s+/g, ' ').trim() });
    }
  }
  return hits;
}
