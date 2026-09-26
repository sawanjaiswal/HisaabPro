#!/usr/bin/env node

/**
 * merge-duplicate-classnames.mjs
 * Merges duplicate className attributes on any JSX element.
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
let mergedCount = 0

// Match JSX open tags with duplicate className="..."
// Regex to find className="A" ... className="B" inside the same JSX open tag
for (const file of files) {
  let content = readFileSync(file, 'utf8')
  let changed = false

  // Regex to match tags spanning lines
  const DUP_CLASSNAME_RE = /(<[A-Za-z0-9_.]+\s+[^>]*?className=["']([^"']+)["'][^>]*?)className=["']([^"']+)["']/g

  while (DUP_CLASSNAME_RE.test(content)) {
    content = content.replace(DUP_CLASSNAME_RE, (match, before, class1, class2) => {
      changed = true
      return `${before.replace(`className="${class1}"`, `className="${class1} ${class2}"`).replace(`className='${class1}'`, `className='${class1} ${class2}'`)}`
    })
  }

  if (changed) {
    writeFileSync(file, content, 'utf8')
    mergedCount++
  }
}

console.log(`✅ Merged duplicate className attributes in ${mergedCount} files.`)
