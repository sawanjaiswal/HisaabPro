import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('merges Tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('handles empty call', () => {
    expect(cn()).toBe('')
  })

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })
})
