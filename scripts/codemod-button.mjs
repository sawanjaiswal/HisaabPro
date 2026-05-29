/** One-off codemod: migrate raw <button className="btn …"> → <Button variant size>.
 *
 * SAFE by construction — only transforms a <button> when:
 *   • className is a plain string literal containing the `btn` base token, and
 *   • it carries exactly one recognised variant (primary/secondary/accent/
 *     destructive/ghost) and at most one recognised size (sm/md/lg), and
 *   • no UNrecognised btn-* token remains (btn-outline/icon/cancel/block → skip,
 *     left for manual review so we never silently drop styling).
 *
 * Uses @babel/parser only to LOCATE nodes; edits are byte-surgery on the original
 * source (applied end→start) so formatting is preserved exactly. Closing tag and
 * the import are handled too. Run: node scripts/codemod-button.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { parse } from '@babel/parser'

const WRITE = process.argv.includes('--write')
const VARIANTS = new Set(['primary', 'secondary', 'accent', 'destructive', 'ghost'])
const SIZES = new Set(['sm', 'md', 'lg'])

const files = execSync(
  `grep -rl 'className="btn' src --include='*.tsx' | grep -vE 'src/components/ui/|src/features/landing/|\\.test\\.|__tests__'`,
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)

let totalButtons = 0
let totalFiles = 0
const skipped = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  let ast
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  } catch (e) {
    skipped.push(`${file} — parse error: ${e.message}`)
    continue
  }

  // Collect edits as {start, end, text}; apply end→start.
  const edits = []
  let migratedInFile = 0

  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'JSXElement' && node.openingElement?.name?.name === 'button') {
      const open = node.openingElement
      const classAttr = open.attributes.find(
        (a) => a.type === 'JSXAttribute' && a.name?.name === 'className',
      )
      const isStringClass =
        classAttr &&
        classAttr.value?.type === 'StringLiteral' &&
        /\bbtn\b/.test(classAttr.value.value)

      if (isStringClass) {
        const tokens = classAttr.value.value.trim().split(/\s+/)
        const variants = tokens.filter((t) => VARIANTS.has(t.replace(/^btn-/, '')) && t.startsWith('btn-'))
        const sizes = tokens.filter((t) => SIZES.has(t.replace(/^btn-/, '')) && t.startsWith('btn-'))
        const unknownBtn = tokens.filter(
          (t) =>
            t.startsWith('btn-') &&
            !VARIANTS.has(t.replace(/^btn-/, '')) &&
            !SIZES.has(t.replace(/^btn-/, '')),
        )
        const leftover = tokens.filter((t) => t !== 'btn' && !t.startsWith('btn-'))

        if (variants.length === 1 && sizes.length <= 1 && unknownBtn.length === 0) {
          const variant = variants[0].replace(/^btn-/, '')
          const size = sizes[0]?.replace(/^btn-/, '')
          let repl = `variant="${variant}"`
          if (size) repl += ` size="${size}"`
          if (leftover.length) repl += ` className="${leftover.join(' ')}"`

          // Edit 1: replace className attribute node with the new attributes.
          edits.push({ start: classAttr.start, end: classAttr.end, text: repl })
          // Edit 2: opening tag name `button` → `Button`.
          edits.push({ start: open.name.start, end: open.name.end, text: 'Button' })
          // Edit 3: closing tag name.
          if (node.closingElement) {
            const c = node.closingElement.name
            edits.push({ start: c.start, end: c.end, text: 'Button' })
          }
          migratedInFile++
        }
      }
    }
    for (const key of Object.keys(node)) {
      const child = node[key]
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child.type === 'string') visit(child)
    }
  }
  visit(ast.program)

  if (migratedInFile === 0) continue

  // Apply byte-surgery end→start.
  edits.sort((a, b) => b.start - a.start)
  let out = src
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)

  // Ensure the Button import exists.
  if (!/from ['"]@\/components\/ui\/Button['"]/.test(out)) {
    const m = out.match(/^import .*\n/m)
    if (m) {
      const idx = out.indexOf(m[0]) + m[0].length
      out = out.slice(0, idx) + `import { Button } from '@/components/ui/Button'\n` + out.slice(idx)
    }
  }

  totalButtons += migratedInFile
  totalFiles++
  if (WRITE) writeFileSync(file, out)
  console.log(`${WRITE ? 'wrote' : 'would migrate'} ${migratedInFile}  ${file}`)
}

console.log(`\n${WRITE ? 'migrated' : 'would migrate'} ${totalButtons} buttons across ${totalFiles} files`)
if (skipped.length) {
  console.log(`\nskipped (manual review):`)
  skipped.forEach((s) => console.log('  ' + s))
}
