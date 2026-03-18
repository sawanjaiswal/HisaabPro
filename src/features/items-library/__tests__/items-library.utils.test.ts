import { describe, it, expect } from 'vitest'
import { searchLibraryItems, getLibraryItemById } from '../items-library.utils'

// ─── searchLibraryItems ───────────────────────────────────────────────────────

describe('searchLibraryItems', () => {
  it('returns paginated results', () => {
    const result = searchLibraryItems('', null, 1, 10)
    expect(result.items.length).toBeLessThanOrEqual(10)
    expect(result.total).toBeGreaterThan(0)
  })

  it('filters by search query', () => {
    const result = searchLibraryItems('rice', null, 1, 50)
    result.items.forEach((item) => {
      expect(item.name.toLowerCase()).toContain('rice')
    })
  })

  it('filters by category', () => {
    const all = searchLibraryItems('', null, 1, 100)
    if (all.items.length === 0) return // no seed data
    const firstCategory = all.items[0].category
    const filtered = searchLibraryItems('', firstCategory, 1, 100)
    filtered.items.forEach((item) => {
      expect(item.category).toBe(firstCategory)
    })
  })

  it('paginates correctly', () => {
    const page1 = searchLibraryItems('', null, 1, 5)
    const page2 = searchLibraryItems('', null, 2, 5)
    if (page1.total <= 5) return // not enough items
    expect(page2.items[0].id).not.toBe(page1.items[0].id)
  })

  it('returns hasMore when more pages exist', () => {
    const result = searchLibraryItems('', null, 1, 5)
    if (result.total > 5) {
      expect(result.hasMore).toBe(true)
    }
  })
})

// ─── getLibraryItemById ───────────────────────────────────────────────────────

describe('getLibraryItemById', () => {
  it('finds item by ID', () => {
    const all = searchLibraryItems('', null, 1, 1)
    if (all.items.length === 0) return
    const found = getLibraryItemById(all.items[0].id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(all.items[0].id)
  })

  it('returns undefined for unknown ID', () => {
    expect(getLibraryItemById('nonexistent')).toBeUndefined()
  })
})
