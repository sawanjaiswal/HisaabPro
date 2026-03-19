import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSmartGreetings } from '../useSmartGreetings'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

import type { GreetingTemplate } from '../smart-greetings.types'

const MOCK_TEMPLATES: GreetingTemplate[] = [
  { id: 't1', name: 'Diwali Wish', occasion: 'DIWALI', message: 'Happy Diwali {{name}}!', gradient: '#f00', emoji: '🪔' },
  { id: 't2', name: 'Holi Wish', occasion: 'HOLI', message: 'Happy Holi {{name}}!', gradient: '#0f0', emoji: '🎨' },
]

vi.mock('../smart-greetings.constants', () => ({
  GREETING_TEMPLATES: [
    { id: 't1', name: 'Diwali Wish', occasion: 'DIWALI', message: 'Happy Diwali {{name}}!', gradient: '#f00', emoji: '🪔' },
    { id: 't2', name: 'Holi Wish', occasion: 'HOLI', message: 'Happy Holi {{name}}!', gradient: '#0f0', emoji: '🎨' },
  ],
  OCCASION_LABELS: { DIWALI: 'Diwali', HOLI: 'Holi' },
}))

vi.mock('../smart-greetings.utils', () => ({
  personalizeMessage: (msg: string, name: string) => msg.replace('{{name}}', name),
  buildWhatsAppLink: (phone: string, msg: string) => `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
}))

const mockWindowOpen = vi.fn()
vi.stubGlobal('open', mockWindowOpen)

beforeEach(() => { vi.clearAllMocks() })

describe('useSmartGreetings', () => {
  it('starts with all templates and no selection', () => {
    const { result } = renderHook(() => useSmartGreetings())
    expect(result.current.templates).toHaveLength(2)
    expect(result.current.selectedTemplate).toBeNull()
    expect(result.current.sendStatus).toBe('idle')
  })

  it('filters templates by occasion', () => {
    const { result } = renderHook(() => useSmartGreetings())

    act(() => { result.current.setFilterOccasion('DIWALI') })
    expect(result.current.templates).toHaveLength(1)
    expect(result.current.templates[0].occasion).toBe('DIWALI')
  })

  it('selectTemplate sets template and custom message', () => {
    const { result } = renderHook(() => useSmartGreetings())

    act(() => { result.current.selectTemplate(MOCK_TEMPLATES[0]) })
    expect(result.current.selectedTemplate?.id).toBe('t1')
    expect(result.current.customMessage).toBe('Happy Diwali {{name}}!')
  })

  it('sendToParty opens WhatsApp and shows toast', () => {
    const { result } = renderHook(() => useSmartGreetings())

    act(() => { result.current.selectTemplate(MOCK_TEMPLATES[0]) })
    act(() => { result.current.sendToParty({ id: 'p1', name: 'Raju', phone: '9876543210' }) })

    expect(mockWindowOpen).toHaveBeenCalledWith(expect.stringContaining('wa.me'), '_blank')
    expect(mockToast.success).toHaveBeenCalledWith('Opening WhatsApp for Raju')
  })

  it('sendToParty shows error when no phone', () => {
    const { result } = renderHook(() => useSmartGreetings())

    act(() => { result.current.sendToParty({ id: 'p1', name: 'Raju' }) })
    expect(mockToast.error).toHaveBeenCalledWith('Raju has no phone number')
    expect(mockWindowOpen).not.toHaveBeenCalled()
  })

  it('reset clears selection and status', () => {
    const { result } = renderHook(() => useSmartGreetings())

    act(() => { result.current.selectTemplate(MOCK_TEMPLATES[0]) })
    act(() => { result.current.reset() })

    expect(result.current.selectedTemplate).toBeNull()
    expect(result.current.customMessage).toBe('')
    expect(result.current.sendStatus).toBe('idle')
  })
})
