import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkSelect } from '../useBulkSelect'

describe('useBulkSelect', () => {
  it('starts with no selections', () => {
    const { result } = renderHook(() => useBulkSelect())
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.isActive).toBe(false)
  })

  it('toggles selection on', () => {
    const { result } = renderHook(() => useBulkSelect())
    act(() => result.current.toggle('id-1'))
    expect(result.current.isSelected('id-1')).toBe(true)
    expect(result.current.selectedCount).toBe(1)
    expect(result.current.isActive).toBe(true)
  })

  it('toggles selection off', () => {
    const { result } = renderHook(() => useBulkSelect())
    act(() => result.current.toggle('id-1'))
    act(() => result.current.toggle('id-1'))
    expect(result.current.isSelected('id-1')).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('selects all provided IDs', () => {
    const { result } = renderHook(() => useBulkSelect())
    act(() => result.current.selectAll(['a', 'b', 'c']))
    expect(result.current.selectedCount).toBe(3)
    expect(result.current.isSelected('a')).toBe(true)
    expect(result.current.isSelected('b')).toBe(true)
    expect(result.current.isSelected('c')).toBe(true)
  })

  it('selectAll replaces previous selection', () => {
    const { result } = renderHook(() => useBulkSelect())
    act(() => result.current.toggle('old-id'))
    act(() => result.current.selectAll(['new-1', 'new-2']))
    expect(result.current.isSelected('old-id')).toBe(false)
    expect(result.current.selectedCount).toBe(2)
  })

  it('clears all selections', () => {
    const { result } = renderHook(() => useBulkSelect())
    act(() => result.current.selectAll(['a', 'b']))
    act(() => result.current.clear())
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.isActive).toBe(false)
  })

  it('handles multiple toggles on different IDs', () => {
    const { result } = renderHook(() => useBulkSelect())
    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
      result.current.toggle('c')
    })
    expect(result.current.selectedCount).toBe(3)
    act(() => result.current.toggle('b'))
    expect(result.current.selectedCount).toBe(2)
    expect(result.current.isSelected('b')).toBe(false)
  })
})
