/**
 * Regression guard for the transparent-modal bug.
 *
 * See `.claude/fix-trace-modal-transparent.md`. `.modal` relied on the UA
 * stylesheet's `dialog { background-color: canvas }` for its opaque surface.
 * Commit 74fd421 ported Modal/ConfirmDialog to Radix, which portals plain
 * `<div>`s — the UA rule stopped applying and every modal in the app went
 * see-through.
 *
 * Scope, stated honestly: jsdom does not apply linked stylesheets, so this
 * cannot assert computed paint. It parses the stylesheet and asserts the
 * declaration exists. That is enough to catch the exact regression (a
 * surface class with no background) and to fail if someone removes it again.
 * Visual proof is the 425px screenshot in the commit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const css = readFileSync(
  resolve(__dirname, '../../../styles/components-overlay.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '') // section banners sit inside selector heads

/** Body of the first rule whose selector list contains `selector`. */
function ruleBody(selector: string): string {
  const rules = css.split('}')
  const match = rules.find((r) => {
    const head = r.split('{')[0]
    return head
      .split(',')
      .map((s) => s.trim())
      .includes(selector)
  })
  if (!match) throw new Error(`No rule found for selector "${selector}"`)
  return match.split('{')[1] ?? ''
}

describe('overlay surface classes', () => {
  it('.modal declares an opaque background — it is a div, not a <dialog>', () => {
    // The bug: this rule had border/radius/padding/shadow but no background,
    // so the Radix-portalled div painted nothing and content read through.
    expect(ruleBody('.modal')).toMatch(/(^|[\s;])background:/)
  })

  it('.modal fills with a theme token, not a literal colour', () => {
    // A hex here would break dark mode, which swaps via CSS vars only.
    const body = ruleBody('.modal')
    const background = /background:\s*([^;]+)/.exec(body)?.[1] ?? ''
    expect(background).toMatch(/var\(--/)
    expect(background).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})
