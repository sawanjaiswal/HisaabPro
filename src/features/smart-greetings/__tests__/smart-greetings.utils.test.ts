import { describe, it, expect } from 'vitest'
import {
  personalizeMessage,
  buildWhatsAppLink,
  groupByOccasion,
} from '../smart-greetings.utils'

// ─── personalizeMessage ───────────────────────────────────────────────────────

describe('personalizeMessage', () => {
  it('replaces {{name}} with party name', () => {
    expect(personalizeMessage('Hello {{name}}!', 'Raju')).toBe('Hello Raju!')
  })

  it('replaces multiple occurrences', () => {
    expect(personalizeMessage('Dear {{name}}, {{name}} is great', 'Priya'))
      .toBe('Dear Priya, Priya is great')
  })

  it('returns unchanged if no placeholder', () => {
    expect(personalizeMessage('Hello world', 'Raju')).toBe('Hello world')
  })
})

// ─── buildWhatsAppLink ────────────────────────────────────────────────────────

describe('buildWhatsAppLink', () => {
  it('builds link with 91 prefix for Indian number', () => {
    const link = buildWhatsAppLink('9876543210', 'Hello')
    expect(link).toBe('https://wa.me/919876543210?text=Hello')
  })

  it('strips + from international number', () => {
    const link = buildWhatsAppLink('+919876543210', 'Hi')
    expect(link).toBe('https://wa.me/919876543210?text=Hi')
  })

  it('encodes message text', () => {
    const link = buildWhatsAppLink('9876543210', 'Hello World!')
    expect(link).toContain('text=Hello%20World!')
  })
})

// ─── groupByOccasion ──────────────────────────────────────────────────────────

describe('groupByOccasion', () => {
  it('groups items by occasion field', () => {
    const items = [
      { occasion: 'DIWALI', name: 'a' },
      { occasion: 'DIWALI', name: 'b' },
      { occasion: 'HOLI', name: 'c' },
    ]
    const groups = groupByOccasion(items)
    expect(groups.get('DIWALI')).toHaveLength(2)
    expect(groups.get('HOLI')).toHaveLength(1)
  })

  it('returns empty map for empty array', () => {
    expect(groupByOccasion([])).toEqual(new Map())
  })
})
