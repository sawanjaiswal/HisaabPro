#!/usr/bin/env node

/**
 * codemod-migrate-text.mjs
 * Migrates <p> tags with typography/styling classes to <Text> primitive.
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
      } else if (['.tsx'].includes(extname(entry.name))) {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
}

const files = walk(SRC)
let migratedCount = 0

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  let modified = false

  // Replace <p className=... or <p style=... with <Text ...
  // Match standard <p className="...">...</p>
  const P_TAG_RE = /<p(\s+[^>]*?)>/g
  const P_CLOSE_RE = /<\/p>/g

  if (P_TAG_RE.test(content)) {
    content = content.replace(P_TAG_RE, '<Text$1>')
    content = content.replace(P_CLOSE_RE, '</Text>')
    modified = true
  }

  if (modified) {
    // Add import at the top if not present
    if (!content.includes("from '@/components/ui/Text'")) {
      const importStatement = `import { Text } from '@/components/ui/Text'`
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
        lines.splice(lastImportLineIdx + 1, 0, importStatement)
        content = lines.join('\n')
      } else {
        content = importStatement + '\n' + content
      }
    }

    writeFileSync(file, content, 'utf8')
    migratedCount++
  }
}

console.log(`🎉 Migrated <p> elements across ${migratedCount} feature files to <Text> primitive!`)
