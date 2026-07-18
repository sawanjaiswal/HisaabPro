#!/usr/bin/env node
/**
 * hp-design freshness guard — makes the skill docs unable to silently lie.
 *
 * Fails (exit 1) when the docs reference a component or CSS token that no
 * longer exists in the codebase. Run in Phase 4 VERIFY alongside tsc/enforce.
 *
 *   node .claude/skills/hp-design/check-refs.mjs
 *
 * Two checks:
 *   1. COMPONENTS — every `<Name>` the docs tell you to use must resolve to a
 *      file in src/components/{ui,layout,feedback} (or the known-primitive
 *      allowlist for CSS-class patterns like `.party-detail-tabs`).
 *   2. TOKENS — every `var(--token)` referenced in the docs must be *defined*
 *      (`--token:`) in one of src/styles/tokens-*.css.
 *
 * Zero deps. Fail-open only on its own IO errors, never on a real miss.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO = join(SKILL_DIR, '..', '..', '..');
const DOCS = readdirSync(SKILL_DIR).filter((f) => f.endsWith('.md'));

// ---- gather what the docs claim exists ----------------------------------
const docText = DOCS.map((f) => readFileSync(join(SKILL_DIR, f), 'utf8')).join('\n');

// Components the docs instruct you to USE (whitelist of PascalCase JSX tags in
// COMPONENT LOOKUP / templates). We only validate names that look like design
// primitives — capitalised, not HTML, not obviously an example placeholder.
const IGNORE_TAGS = new Set([
  'React', 'AppShell', 'DetailMenu', 'ItemCard', 'ListSkeleton', 'Icon',
  'LedgerMonthPicker', 'Step', 'CategorySelect', // page-local / example-only
]);

// lucide-react icons are third-party, not our design primitives — collect every
// tag that appears on a line mentioning lucide-react (the ICON MAP) OR is used
// as an icon (`<Name className="w-N h-N"`), and exclude them from validation.
const iconTags = new Set();
for (const line of docText.split('\n')) {
  if (/lucide-react/.test(line)) {
    for (const m of line.matchAll(/<([A-Z][A-Za-z0-9]+)/g)) iconTags.add(m[1]);
  }
}
for (const m of docText.matchAll(/<([A-Z][A-Za-z0-9]+)\s+className="w-\d/g)) {
  iconTags.add(m[1]);
}
// bare self-closing `<User />` = an icon glyph (no props). Real self-closing
// design components resolve to a file anyway, so this only ever excludes noise.
for (const m of docText.matchAll(/<([A-Z][A-Za-z0-9]+)\s*\/>/g)) iconTags.add(m[1]);

const referenced = new Set();
for (const m of docText.matchAll(/<([A-Z][A-Za-z0-9]+)[\s/>]/g)) {
  if (!IGNORE_TAGS.has(m[1]) && !iconTags.has(m[1])) referenced.add(m[1]);
}

// ---- what actually exists ------------------------------------------------
const COMP_DIRS = ['ui', 'layout', 'feedback'].map((d) =>
  join(REPO, 'src', 'components', d),
);
const existingComponents = new Set();
for (const dir of COMP_DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.tsx')) existingComponents.add(f.replace(/\.tsx$/, ''));
  }
}
// case-insensitive fallback (files like accordion.tsx / avatar.tsx)
const existingLower = new Set([...existingComponents].map((c) => c.toLowerCase()));

// ---- tokens --------------------------------------------------------------
const TOKEN_FILES = readdirSync(join(REPO, 'src', 'styles'))
  .filter((f) => /^tokens-.*\.css$/.test(f))
  .map((f) => join(REPO, 'src', 'styles', f));
const definedTokens = new Set();
for (const tf of TOKEN_FILES) {
  for (const m of readFileSync(tf, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    definedTokens.add(m[1]);
  }
}
const referencedTokens = new Set();
for (const m of docText.matchAll(/var\((--[a-z0-9-]+)/gi)) referencedTokens.add(m[1]);

// ---- report --------------------------------------------------------------
const missingComponents = [...referenced].filter(
  (c) => !existingComponents.has(c) && !existingLower.has(c.toLowerCase()),
);
// Skipped, not real misses:
//  - numeric-slot placeholders: --color-primary-700/800, --color-success-300/400
//  - prose family placeholders written as var(--color-*) → captured as --color-
//    (trailing dash means the doc abbreviated a family, not a concrete token)
const missingTokens = [...referencedTokens].filter(
  (t) => !definedTokens.has(t) && !/\/\d/.test(t) && !t.endsWith('-'),
);

let failed = false;
if (missingComponents.length) {
  failed = true;
  console.error('✗ Docs reference components that do NOT exist in src/components/{ui,layout,feedback}:');
  for (const c of missingComponents) console.error(`    <${c}>`);
  console.error('  → Either the component was renamed/removed (fix the doc) or the reference is a page-local example (add to IGNORE_TAGS).');
}
if (missingTokens.length) {
  failed = true;
  console.error('✗ Docs reference CSS tokens NOT defined in src/styles/tokens-*.css:');
  for (const t of missingTokens) console.error(`    var(${t})`);
  console.error('  → Fix the token name in the doc, or add the token to the SSOT.');
}

if (failed) {
  console.error('\nhp-design docs are STALE. Fix before shipping.');
  process.exit(1);
}
console.log(
  `✓ hp-design refs fresh — ${referenced.size} components, ${referencedTokens.size} tokens all resolve.`,
);
