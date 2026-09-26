#!/usr/bin/env node

/**
 * fix-import-locations.mjs
 * Cleans up and puts all top-level imports at the very top of files.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

const EXCLUDE_DIRS = ['__tests__', 'node_modules', 'dist', 'src/styles']

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
let cleanedCount = 0

const MISPLACED_HEADING_IMPORT = /\nimport\s+{\s*Heading\s*}\s+from\s+['"]@\/components\/ui\/Heading['"]\n?/g

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  if (MISPLACED_HEADING_IMPORT.test(content)) {
    // Remove all occurrences first
    content = content.replace(MISPLACED_HEADING_IMPORT, '\n')

    // If file uses <Heading, insert at top
    if (/<Heading[\s>]/.test(content)) {
      const importStatement = `import { Heading } from '@/components/ui/Heading'\n`
      // Find the last real import line at the top
      const lines = content.split('\n')
      let lastImportLineIdx = -1
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import{')) {
          lastImportLineIdx = i
        } else if (lines[i].trim().startsWith('export ') || lines[i].trim().startsWith('function ') || lines[i].trim().startsWith('const ') || lines[i].trim().startsWith('interface ')) {
          if (lastImportLineIdx !== -1) break
        }
      }

      if (lastImportLineIdx !== -1) {
        lines.splice(lastImportLineIdx + 1, 0, importStatement.trim())
        content = lines.join('\n')
      } else {
        content = importStatement + content
      }
    }

    writeFileSync(file, content, 'utf8')
    cleanedCount++
  }
}

console.log(`✅ Cleaned import placement in ${cleanedCount} files.`)
