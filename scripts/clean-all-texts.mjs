#!/usr/bin/env node

/**
 * clean-all-texts.mjs
 * Comprehensive cleaner that replaces inline font styles and ad-hoc typography
 * with clean design token classes across all pages and UI components.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

const EXCLUDE_DIRS = ['__tests__', 'node_modules', 'dist', 'src/styles/tokens-']

function walk(dir) {
  const results = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.some(ex => fullPath.includes(ex))) continue
        results.push(...walk(fullPath))
      } else if (['.tsx', '.ts'].includes(extname(entry.name))) {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
}

const files = walk(SRC)
let cleanedFiles = 0

// Patterns to convert
const REPLACEMENTS = [
  // Common inline fontSize + color combinations on Text / div / span
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-xs\)['"],\s*color:\s*['"]var\(--color-text-secondary\)['"]\s*\}\}/g,
    to: 'className="text-xs text-[var(--text-secondary)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-xs\)['"],\s*color:\s*['"]var\(--text-secondary\)['"]\s*\}\}/g,
    to: 'className="text-xs text-[var(--text-secondary)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-xs\)['"],\s*color:\s*['"]var\(--color-text-muted\)['"]\s*\}\}/g,
    to: 'className="text-xs text-[var(--text-muted)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-xs\)['"],\s*color:\s*['"]var\(--text-muted\)['"]\s*\}\}/g,
    to: 'className="text-xs text-[var(--text-muted)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-xs\)['"],\s*color:\s*['"]var\(--lp-text-muted\)['"]\s*\}\}/g,
    to: 'className="text-xs text-[var(--text-muted)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-sm\)['"],\s*color:\s*['"]var\(--color-text-secondary\)['"]\s*\}\}/g,
    to: 'className="text-sm text-[var(--text-secondary)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-sm\)['"],\s*color:\s*['"]var\(--text-secondary\)['"]\s*\}\}/g,
    to: 'className="text-sm text-[var(--text-secondary)]"'
  },
  {
    from: /style=\{\{\s*color:\s*['"]var\(--color-text-secondary\)['"],\s*fontSize:\s*['"]var\(--fs-sm\)['"]\s*\}\}/g,
    to: 'className="text-sm text-[var(--text-secondary)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-sm\)['"],\s*color:\s*['"]var\(--color-text-primary\)['"]\s*\}\}/g,
    to: 'className="text-sm text-[var(--text-primary)] font-medium"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-base\)['"],\s*color:\s*['"]var\(--color-text-primary\)['"]\s*\}\}/g,
    to: 'className="text-sm text-[var(--text-primary)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-base\)['"],\s*color:\s*['"]var\(--text-primary\)['"]\s*\}\}/g,
    to: 'className="text-sm text-[var(--text-primary)]"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-lg\)['"],\s*color:\s*['"]var\(--color-text-primary\)['"]\s*\}\}/g,
    to: 'className="text-base text-[var(--text-primary)] font-semibold"'
  },
  {
    from: /style=\{\{\s*fontSize:\s*['"]var\(--fs-xl\)['"],\s*color:\s*['"]var\(--color-text-primary\)['"]\s*\}\}/g,
    to: 'className="text-lg text-[var(--text-primary)] font-semibold"'
  },
  {
    from: /style=\{\{\s*fontWeight:\s*600,\s*fontSize:\s*['"]var\(--fs-base\)['"],\s*color:\s*['"]var\(--color-text-primary\)['"]\s*\}\}/g,
    to: 'className="text-sm font-semibold text-[var(--text-primary)]"'
  },
  {
    from: /style=\{\{\s*fontWeight:\s*600,\s*fontSize:\s*['"]var\(--fs-sm\)['"],\s*color:\s*['"]var\(--color-text-primary\)['"]\s*\}\}/g,
    to: 'className="text-sm font-semibold text-[var(--text-primary)]"'
  },

  // Marketing pages 20px / 22px headers
  {
    from: /style=\{\{\s*fontSize:\s*['"]20px['"],\s*fontWeight:\s*700,\s*color:\s*['"]var\(--color-gray-900\)['"],\s*margin:\s*0\s*\}\}/g,
    to: 'className="text-xl font-bold text-[var(--text-primary)] m-0"'
  },
  {
    from: /style=\{\{\s*flex:\s*1,\s*fontSize:\s*['"]20px['"],\s*fontWeight:\s*700,\s*color:\s*['"]var\(--color-gray-900\)['"],\s*margin:\s*0\s*\}\}/g,
    to: 'className="flex-1 text-xl font-bold text-[var(--text-primary)] m-0"'
  },
]

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  let modified = false

  for (const { from, to } of REPLACEMENTS) {
    if (from.test(content)) {
      content = content.replace(from, to)
      modified = true
    }
  }

  if (modified) {
    writeFileSync(file, content, 'utf8')
    cleanedFiles++
  }
}

console.log(`✨ Standardized inline text typography across ${cleanedFiles} files!`)
