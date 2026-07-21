#!/usr/bin/env node
/**
 * Per-page UI-state scan — regenerates §2 of docs/GOLD_STANDARD_REDESIGN.md.
 *
 * Structural only: proves a state component is imported, NOT that it renders
 * the right thing. Treat the output as an UPPER BOUND on quality. Read the
 * empty-state caveat in §2 before calling a detail page "missing empty" —
 * detail pages and forms have no empty state by design.
 *
 * Usage: node scripts/scan-ui-states.mjs [--files]
 */

import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const files = execSync(
  "find src/features src/pages -name '*Page.tsx' -not -name '*.test.*' 2>/dev/null",
)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean)

const rows = files.map((f) => {
  const s = readFileSync(f, 'utf8')
  return {
    f: f.replace('src/features/', '').replace('src/pages/', 'pages/'),
    err: /ErrorState|onRetry/.test(s),
    empty: /EmptyState/.test(s),
    load: /Skeleton|animate-pulse|isLoading|isPending/.test(s),
    i18n: /useLanguage/.test(s),
    shell: /PageContainer|HeroPage|AppShell/.test(s),
  }
})

const CHECKS = ['err', 'empty', 'load', 'i18n', 'shell']
const gaps = rows.filter((r) => !CHECKS.every((k) => r[k]))

console.log(`total=${rows.length} gold=${rows.length - gaps.length} gaps=${gaps.length}`)
console.log()

const byArea = {}
for (const r of gaps) (byArea[r.f.split('/')[0]] ||= []).push(r)

console.log('area\tpages\terror\tempty\tloading\ti18n\tshell')
for (const [area, list] of Object.entries(byArea).sort((a, b) => b[1].length - a[1].length)) {
  const miss = (k) => list.filter((r) => !r[k]).length
  console.log(
    `${area}\t${list.length}\t${miss('err')}\t${miss('empty')}\t${miss('load')}\t${miss('i18n')}\t${miss('shell')}`,
  )
}

if (process.argv.includes('--files')) {
  console.log('\nper-file gaps:')
  for (const r of gaps) {
    console.log(`  ${r.f} — missing ${CHECKS.filter((k) => !r[k]).join(', ')}`)
  }
}
