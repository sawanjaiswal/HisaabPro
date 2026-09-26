#!/usr/bin/env node

/**
 * codemod-migrate-primitives.mjs
 * Migrates raw HTML headings (<h1>..<h6>) and paragraph elements (<p>)
 * to design system primitives (<Heading> and <Text>) across features.
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
let migratedFiles = 0

for (const file of files) {
  const relPath = relative(ROOT, file)
  let content = readFileSync(file, 'utf8')
  let modified = false

  let needsHeading = false
  let needsText = false

  // 1. Transform <h1-6>
  for (let lvl = 1; lvl <= 6; lvl++) {
    const openRe = new RegExp(`<h${lvl}(\\s|>)`, 'g')
    const closeRe = new RegExp(`</h${lvl}>`, 'g')

    if (openRe.test(content)) {
      content = content.replace(openRe, `<Heading level={${lvl}}$1`)
      content = content.replace(closeRe, `</Heading>`)
      needsHeading = true
      modified = true
    }
  }

  // 2. Add imports if needed and not already present
  if (modified) {
    const importsToAdd = []
    if (needsHeading && !content.includes('Heading') && !content.includes('@/components/ui/Heading')) {
      importsToAdd.push('Heading')
    }

    if (importsToAdd.length > 0) {
      const importStatement = `import { ${importsToAdd.join(', ')} } from '@/components/ui/Heading'\n`
      // Insert after last import
      const lastImportIndex = content.lastIndexOf('import ')
      if (lastImportIndex !== -1) {
        const nextLineIndex = content.indexOf('\n', lastImportIndex)
        content = content.slice(0, nextLineIndex + 1) + importStatement + content.slice(nextLineIndex + 1)
      } else {
        content = importStatement + content
      }
    }

    writeFileSync(file, content, 'utf8')
    migratedFiles++
  }
}

console.log(`🎉 Migrated headings across ${migratedFiles} feature/page files to <Heading> primitive!`)
