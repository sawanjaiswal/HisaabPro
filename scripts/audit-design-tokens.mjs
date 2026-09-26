#!/usr/bin/env node

/**
 * audit-design-tokens.mjs
 * Phase 0: Scans src/ for raw hex colors, arbitrary Tailwind bracket syntax,
 * inline styles with sizes/colors, and un-tokenized typography.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

const HEX_COLOR_RE = /#([0-9a-fA-F]{3,8})\b/g
const ARBITRARY_TAILWIND_RE = /\b[a-zA-Z0-9_-]+-\[[^\]]+\]/g
const INLINE_STYLE_RAW_SIZE_OR_COLOR_RE = /style=\{\{[^}]*\b(?:font-?size|color|background|height|width|padding|margin|gap)\s*:\s*['"`]?(\d+px|#[0-9a-fA-F]{3,8})/gi

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
const findings = {
  rawHex: [],
  arbitraryTailwind: [],
  inlineRawStyles: [],
}

// Ignore CSS token definition files for raw hex
const TOKEN_DEFINITION_FILES = [
  'src/styles/tokens-colors.css',
  'src/styles/tokens-core.css',
  'src/styles/tokens-dark.css',
  'src/styles/tokens-variants.css',
]

for (const file of files) {
  const relPath = relative(ROOT, file)
  const isTokenDef = TOKEN_DEFINITION_FILES.some(t => relPath.endsWith(t))
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, lineIdx) => {
    // 1. Raw Hex Check
    if (!isTokenDef) {
      let match
      const hexRegex = new RegExp(HEX_COLOR_RE)
      while ((match = hexRegex.exec(line)) !== null) {
        findings.rawHex.push({
          file: relPath,
          line: lineIdx + 1,
          match: match[0],
          context: line.trim()
        })
      }
    }

    // 2. Arbitrary Tailwind Brackets
    let twMatch
    const twRegex = new RegExp(ARBITRARY_TAILWIND_RE)
    while ((twMatch = twRegex.exec(line)) !== null) {
      findings.arbitraryTailwind.push({
        file: relPath,
        line: lineIdx + 1,
        match: twMatch[0],
        context: line.trim()
      })
    }

    // 3. Inline Raw Style Properties
    let styleMatch
    const styleRegex = new RegExp(INLINE_STYLE_RAW_SIZE_OR_COLOR_RE)
    while ((styleMatch = styleRegex.exec(line)) !== null) {
      findings.inlineRawStyles.push({
        file: relPath,
        line: lineIdx + 1,
        match: styleMatch[1],
        context: line.trim()
      })
    }
  })
}

console.log('═══════════════════════════════════════════════════════════')
console.log('       LEVEL 6 DESIGN SYSTEM: BASELINE AUDIT REPORT       ')
console.log('═══════════════════════════════════════════════════════════')
console.log(`Files Analyzed: ${files.length}`)
console.log(`Raw Hex Literals: ${findings.rawHex.length}`)
console.log(`Arbitrary Utility Syntax: ${findings.arbitraryTailwind.length}`)
console.log(`Inline Style Raw Sizes/Colors: ${findings.inlineRawStyles.length}`)
console.log('═══════════════════════════════════════════════════════════')

const outPath = join(ROOT, '.audit-baseline.json')
writeFileSync(outPath, JSON.stringify(findings, null, 2))
console.log(`Wrote full audit log to ${outPath}\n`)
