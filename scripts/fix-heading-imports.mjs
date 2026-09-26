#!/usr/bin/env node

/**
 * fix-heading-imports.mjs
 * Ensures all files using <Heading have proper imports.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

const EXCLUDE_DIRS = ['__tests__', 'node_modules', 'dist', 'src/styles', 'Heading.tsx']

function walk(dir) {
  const results = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.some(ex => fullPath.includes(ex))) continue
        results.push(...walk(fullPath))
      } else if (['.tsx'].includes(extname(entry.name)) && !entry.name.includes('Heading.tsx')) {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
}

const files = walk(SRC)
let fixedCount = 0

const HAS_HEADING_USAGE = /<Heading[\s>]/
const HAS_HEADING_IMPORT = /import\s+{[^}]*\bHeading\b[^}]*}\s+from\s+['"]@\/components\/ui\/Heading['"]/

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  if (HAS_HEADING_USAGE.test(content) && !HAS_HEADING_IMPORT.test(content)) {
    const importStatement = `import { Heading } from '@/components/ui/Heading'\n`
    const lastImportIndex = content.lastIndexOf('import ')
    if (lastImportIndex !== -1) {
      const nextLineIndex = content.indexOf('\n', lastImportIndex)
      content = content.slice(0, nextLineIndex + 1) + importStatement + content.slice(nextLineIndex + 1)
    } else {
      content = importStatement + content
    }
    writeFileSync(file, content, 'utf8')
    fixedCount++
  }
}

console.log(`✅ Fixed Heading imports in ${fixedCount} files.`)
