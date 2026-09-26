#!/usr/bin/env node

/**
 * codemod-typography-colors.mjs
 * Full-scale automated AST/regex transformer that converts legacy hardcoded
 * colors, arbitrary font sizes, and un-tokenized styling into Level 6 SSOT tokens.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

const COLOR_MAP = [
  // Brand / Emerald (New & Legacy Teal)
  { match: /#026[fF]39\b/g, replace: 'var(--color-primary-500)' },
  { match: /#068[aA]48\b/g, replace: 'var(--color-primary-400)' },
  { match: /#024[eE]29\b/g, replace: 'var(--color-primary-600)' },
  { match: /#013[dD]20\b/g, replace: 'var(--color-primary-700)' },
  { match: /#003121\b/g, replace: 'var(--color-hero-surface)' },
  { match: /#012619\b/g, replace: 'var(--color-hero-surface-deep)' },
  { match: /#0[bB]4[fF]5[eE]\b/g, replace: 'var(--color-primary-500)' }, // legacy teal

  // Accent (Lime-Yellow)
  { match: /#[eE]0[eE][aA]49\b/g, replace: 'var(--color-secondary-300)' },
  { match: /#[cC]8[dD]232\b/g, replace: 'var(--color-secondary-400)' },

  // Success
  { match: /#22[cC]55[eE]\b/g, replace: 'var(--color-success-500)' },
  { match: /#16[aA]034[aA]\b/g, replace: 'var(--color-success-600)' },
  { match: /#059669\b/g, replace: 'var(--color-success-600)' },
  { match: /#[dD]1[fF][aA][eE]5\b/g, replace: 'var(--color-success-100)' },
  { match: /#[eE][cC][fF][dD][fF]5\b/g, replace: 'var(--color-success-50)' },

  // Error / Danger
  { match: /#[eE][fF]4444\b/g, replace: 'var(--color-error-500)' },
  { match: /#[dD][cC]2626\b/g, replace: 'var(--color-error-600)' },
  { match: /#[bB]91[cC]1[cC]\b/g, replace: 'var(--color-error-700)' },
  { match: /#[fF][eE][eE]2[eE]2\b/g, replace: 'var(--color-error-100)' },
  { match: /#[fF][eE][fF]2[fF]2\b/g, replace: 'var(--color-error-50)' },

  // Grays / Surfaces
  { match: /#[fF]9[fF][aA][fF][bB]\b/g, replace: 'var(--color-gray-50)' },
  { match: /#[fF]3[fF]4[fF]6\b/g, replace: 'var(--color-gray-100)' },
  { match: /#[fF]1[fF]5[fF]9\b/g, replace: 'var(--color-gray-100)' },
  { match: /#[eE]5[eE]7[eE][bB]\b/g, replace: 'var(--color-gray-200)' },
  { match: /#[dD]1[dD]5[dD][bB]\b/g, replace: 'var(--color-gray-300)' },
  { match: /#9[cC][aA]3[aA][fF]\b/g, replace: 'var(--color-gray-400)' },
  { match: /#94[aA]3[bB]8\b/g, replace: 'var(--color-gray-400)' },
  { match: /#6[bB]7280\b/g, replace: 'var(--color-gray-500)' },
  { match: /#4[bB]5563\b/g, replace: 'var(--color-gray-600)' },
  { match: /#374151\b/g, replace: 'var(--color-gray-700)' },
  { match: /#1[fF]2937\b/g, replace: 'var(--color-gray-800)' },
  { match: /#1[eE]293[bB]\b/g, replace: 'var(--color-gray-800)' },
  { match: /#111827\b/g, replace: 'var(--color-gray-900)' },
]

const TAILWIND_BRACKET_MAP = [
  // Arbitrary Typography
  { match: /\btext-\[var\(--fs-3xs\)\]/g, replace: 'text-xs' },
  { match: /\btext-\[var\(--fs-2xs\)\]/g, replace: 'text-xs' },
  { match: /\btext-\[var\(--fs-xs\)\]/g, replace: 'text-xs' },
  { match: /\btext-\[var\(--fs-sm\)\]/g, replace: 'text-sm' },
  { match: /\btext-\[var\(--fs-md\)\]/g, replace: 'text-sm' },
  { match: /\btext-\[var\(--fs-df\)\]/g, replace: 'text-base' },
  { match: /\btext-\[var\(--fs-base\)\]/g, replace: 'text-base' },
  { match: /\btext-\[var\(--fs-lg\)\]/g, replace: 'text-lg' },
  { match: /\btext-\[var\(--fs-xl\)\]/g, replace: 'text-xl' },
  { match: /\btext-\[var\(--fs-2xl\)\]/g, replace: 'text-2xl' },
  { match: /\btext-\[0\.625rem\]/g, replace: 'text-xs' },
  { match: /\btext-\[0\.6875rem\]/g, replace: 'text-xs' },
  { match: /\btext-\[0\.75rem\]/g, replace: 'text-xs' },
  { match: /\btext-\[0\.8125rem\]/g, replace: 'text-sm' },
  { match: /\btext-\[0\.875rem\]/g, replace: 'text-sm' },
  { match: /\btext-\[0\.9375rem\]/g, replace: 'text-base' },
  { match: /\btext-\[1rem\]/g, replace: 'text-base' },
  { match: /\btext-\[1\.125rem\]/g, replace: 'text-lg' },

  // Arbitrary Text Colors
  { match: /\btext-\[var\(--color-text\)\]/g, replace: 'text-text-primary' },
  { match: /\btext-\[var\(--color-text-secondary\)\]/g, replace: 'text-text-secondary' },
  { match: /\btext-\[var\(--color-text-muted\)\]/g, replace: 'text-text-muted' },
  { match: /\btext-\[var\(--text-primary\)\]/g, replace: 'text-text-primary' },
  { match: /\btext-\[var\(--text-secondary\)\]/g, replace: 'text-text-secondary' },
  { match: /\btext-\[var\(--text-muted\)\]/g, replace: 'text-text-muted' },
  { match: /\btext-\[var\(--color-primary-500\)\]/g, replace: 'text-primary-500' },
  { match: /\btext-\[var\(--color-primary-600\)\]/g, replace: 'text-primary-600' },
  { match: /\btext-\[var\(--color-success-600\)\]/g, replace: 'text-success-600' },
  { match: /\btext-\[var\(--color-error-600\)\]/g, replace: 'text-error-600' },
  { match: /\btext-\[var\(--color-error-500\)\]/g, replace: 'text-red-500' },
  { match: /\btext-\[var\(--color-gray-500\)\]/g, replace: 'text-gray-500' },
  { match: /\btext-\[var\(--color-gray-400\)\]/g, replace: 'text-gray-400' },
  { match: /\btext-\[var\(--color-on-primary\)\]/g, replace: 'text-white' },
  { match: /\btext-\[0\.5625rem\]/g, replace: 'text-xs' },
  { match: /\btext-\[2\.75rem\]/g, replace: 'text-4xl' },
  { match: /\btext-\[3rem\]/g, replace: 'text-5xl' },
  { match: /\btext-\[3\.5rem\]/g, replace: 'text-6xl' },
  { match: /\btext-\[3\.75rem\]/g, replace: 'text-6xl' },

  // Arbitrary Backgrounds & Borders
  { match: /\bbg-\[var\(--color-surface\)\]/g, replace: 'bg-surface' },
  { match: /\bbg-\[var\(--color-surface-muted\)\]/g, replace: 'bg-surface-subtle' },
  { match: /\bbg-\[var\(--color-primary-50\)\]/g, replace: 'bg-primary-50' },
  { match: /\bbg-\[var\(--color-primary-500\)\]/g, replace: 'bg-primary-500' },
  { match: /\bbg-\[var\(--color-primary-600\)\]/g, replace: 'bg-primary-600' },
  { match: /\bbg-\[var\(--color-primary-700\)\]/g, replace: 'bg-primary-700' },
  { match: /\bbg-\[var\(--color-gray-50\)\]/g, replace: 'bg-gray-50' },
  { match: /\bbg-\[var\(--color-gray-100\)\]/g, replace: 'bg-gray-100' },
  { match: /\bborder-\[var\(--color-border\)\]/g, replace: 'border-border' },
  { match: /\bborder-\[var\(--color-primary-500\)\]/g, replace: 'border-primary-500' },
  { match: /\bborder-\[var\(--color-error-500\)\]/g, replace: 'border-red-500' },
  { match: /\bborder-\[var\(--color-gray-200\)\]/g, replace: 'border-gray-200' },
  { match: /\bborder-\[var\(--color-gray-100\)\]/g, replace: 'border-gray-100' },
  { match: /\bring-\[var\(--color-primary-400\)\]/g, replace: 'ring-primary-400' },
  { match: /\bring-\[var\(--color-primary-100\)\]/g, replace: 'ring-primary-100' },
  { match: /\bmin-h-\[36px\]/g, replace: 'min-h-9' },
  { match: /\brounded-\[32px\]/g, replace: 'rounded-3xl' },

  // Arbitrary Radius & Sizing
  { match: /\brounded-\[var\(--radius-xs\)\]/g, replace: 'rounded-xs' },
  { match: /\brounded-\[var\(--radius-sm\)\]/g, replace: 'rounded-sm' },
  { match: /\brounded-\[var\(--radius-md\)\]/g, replace: 'rounded-md' },
  { match: /\brounded-\[var\(--radius-lg\)\]/g, replace: 'rounded-lg' },
  { match: /\brounded-\[var\(--radius-xl\)\]/g, replace: 'rounded-xl' },
  { match: /\brounded-\[var\(--radius-full\)\]/g, replace: 'rounded-full' },
  { match: /\bmin-h-\[44px\]/g, replace: 'min-h-11' },
]

const IGNORE_FILES = [
  'src/styles/tokens-colors.css',
  'src/styles/tokens-core.css',
  'src/styles/tokens-dark.css',
  'src/styles/tokens-variants.css',
  'src/styles/tokens.ts',
]

function walk(dir, extensions = ['.ts', '.tsx', '.css']) {
  const results = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue
        results.push(...walk(fullPath, extensions))
      } else if (extensions.includes(extname(entry.name))) {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
}

const files = walk(SRC)
let modifiedCount = 0

for (const file of files) {
  const relPath = relative(ROOT, file)
  if (IGNORE_FILES.some(t => relPath.endsWith(t))) continue

  let content = readFileSync(file, 'utf8')
  let changed = false

  // Apply Tailwind bracket mappings
  for (const { match, replace } of TAILWIND_BRACKET_MAP) {
    if (match.test(content)) {
      content = content.replace(match, replace)
      changed = true
    }
  }

  // Apply Color mappings in CSS files and TSX style objects
  for (const { match, replace } of COLOR_MAP) {
    if (match.test(content)) {
      content = content.replace(match, replace)
      changed = true
    }
  }

  if (changed) {
    writeFileSync(file, content, 'utf8')
    modifiedCount++
  }
}

console.log(`✨ Full sweep complete: ${modifiedCount} files updated to Level 6 SSOT design tokens.`)
