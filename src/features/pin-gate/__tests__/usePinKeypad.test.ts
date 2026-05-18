import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePinKeypad } from '../hooks/usePinKeypad'

describe('usePinKeypad', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    expect(result.current.value).toBe('')
  })

  it('appends digits one at a time', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    act(() => result.current.append('1'))
    act(() => result.current.append('2'))
    act(() => result.current.append('3'))
    expect(result.current.value).toBe('123')
  })

  it('caps the value at maxLen', () => {
    const { result } = renderHook(() => usePinKeypad(4))
    act(() => {
      result.current.append('1')
      result.current.append('2')
      result.current.append('3')
      result.current.append('4')
      result.current.append('5') // should be ignored
    })
    expect(result.current.value).toBe('1234')
  })

  it('rejects non-digit input', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    act(() => {
      result.current.append('a')
      result.current.append(' ')
      result.current.append('-')
      result.current.append('11') // multi-char
    })
    expect(result.current.value).toBe('')
  })

  it('backspace removes the trailing digit', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    act(() => {
      result.current.append('1')
      result.current.append('2')
      result.current.append('3')
    })
    act(() => result.current.backspace())
    expect(result.current.value).toBe('12')
  })

  it('backspace on empty value is a no-op', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    act(() => result.current.backspace())
    expect(result.current.value).toBe('')
  })

  it('clear resets to empty', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    act(() => {
      result.current.append('1')
      result.current.append('2')
      result.current.append('3')
      result.current.append('4')
    })
    expect(result.current.value).toBe('1234')
    act(() => result.current.clear())
    expect(result.current.value).toBe('')
  })

  it('append then backspace then append leaves correct value', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    act(() => {
      result.current.append('1')
      result.current.append('2')
      result.current.backspace()
      result.current.append('3')
    })
    expect(result.current.value).toBe('13')
  })

  it('accepts 0 (zero is a valid digit)', () => {
    const { result } = renderHook(() => usePinKeypad(6))
    act(() => result.current.append('0'))
    expect(result.current.value).toBe('0')
  })
})
