/**
 * Settings rows store their icon as a string key, so a typo or a newly added
 * row whose icon is missing from the map renders an *empty tinted square* —
 * it does not throw, and nothing in the type system catches it. Six rows
 * shipped that way (Cloud, Package, Sparkles, Store, Tag, Trophy) before this
 * test existed. It walks the real constants so the next one fails here first.
 */
import { describe, it, expect } from 'vitest'
import { SETTINGS_SECTIONS } from '../settings.constants'
import { SETTINGS_ICONS } from '../settings.icons'

describe('SETTINGS_ICONS', () => {
  const requested = [
    ...new Set(SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.icon))),
  ].sort()

  it('resolves every icon the settings constants ask for', () => {
    const missing = requested.filter((name) => !SETTINGS_ICONS[name])
    expect(missing).toEqual([])
  })

  it('covers the six names that used to render blank squares', () => {
    for (const name of ['Cloud', 'Package', 'Sparkles', 'Store', 'Tag', 'Trophy']) {
      expect(SETTINGS_ICONS[name], `${name} missing`).toBeTruthy()
    }
  })

  it('carries no unused entries — the map tracks the constants, not lucide', () => {
    expect(Object.keys(SETTINGS_ICONS).sort()).toEqual(requested)
  })
})
