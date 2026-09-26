#!/usr/bin/env node

/**
 * fix-text-codemod.mjs
 * Fixes mismatched <p> -> <Text> tags and cleans import placements.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

const EXCLUDE_DIRS = ['__tests__', 'node_modules', 'dist', 'src/styles', 'src/components/ui']

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
let fixedCount = 0

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  let changed = false

  // 1. Fix broken import placement inside multi-line imports
  if (content.includes("import { Text } from '@/components/ui/Text'")) {
    content = content.replace(/\nimport\s+{\s*Text\s*}\s+from\s+['"]@\/components\/ui\/Text['"]\n?/g, '\n')
    // Re-insert cleanly at the very top (after first line or at index 0)
    const lines = content.split('\n')
    let firstImportIdx = lines.findIndex(l => l.trim().startsWith('import '))
    if (firstImportIdx !== -1) {
      lines.splice(firstImportIdx, 0, "import { Text } from '@/components/ui/Text'")
      content = lines.join('\n')
    } else {
      content = "import { Text } from '@/components/ui/Text'\n" + content
    }
    changed = true
  }

  // 2. Fix unmatched <p> without attributes when closing tag is </Text>
  if (/<p>[\s\S]*?<\/Text>/.test(content)) {
    content = content.replace(/<p>/g, '<Text>')
    changed = true
  }

  if (changed) {
    writeFileSync(file, content, 'utf8')
    fixedCount++
  }
}

console.log(`✅ Fixed Text tags & imports in ${fixedCount} files.`)
