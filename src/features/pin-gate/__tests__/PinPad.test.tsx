import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinPad } from '../components/PinPad'
import { KEYPAD_BACKSPACE } from '../pin-gate.constants'

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      pinPadKeyAria: 'PIN digit',
      pinPadBackspaceAria: 'Delete last digit',
      pinPadDotsAria: 'PIN entered',
      pinPadKeypadAria: 'PIN keypad',
    },
  }),
}))

describe('PinPad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dot indicators with the correct length', () => {
    render(<PinPad value="" length={6} onKeyPress={vi.fn()} />)
    const dots = screen.getByRole('img', { name: 'PIN entered' })
    expect(dots.children).toHaveLength(6)
  })

  it('marks filled dots for each entered digit', () => {
    const { container } = render(<PinPad value="123" length={6} onKeyPress={vi.fn()} />)
    const filled = container.querySelectorAll('.pin-pad-dot--filled')
    expect(filled).toHaveLength(3)
  })

  it('marks no dots filled when value is empty', () => {
    const { container } = render(<PinPad value="" length={6} onKeyPress={vi.fn()} />)
    expect(container.querySelectorAll('.pin-pad-dot--filled')).toHaveLength(0)
  })

  it('emits the digit on click', async () => {
    const onKeyPress = vi.fn()
    const user = userEvent.setup()
    render(<PinPad value="" length={6} onKeyPress={onKeyPress} />)

    await user.click(screen.getByRole('button', { name: 'PIN digit 5' }))
    expect(onKeyPress).toHaveBeenCalledWith('5')
  })

  it('emits the backspace sentinel on backspace click', async () => {
    const onKeyPress = vi.fn()
    const user = userEvent.setup()
    render(<PinPad value="12" length={6} onKeyPress={onKeyPress} />)

    await user.click(screen.getByRole('button', { name: 'Delete last digit' }))
    expect(onKeyPress).toHaveBeenCalledWith(KEYPAD_BACKSPACE)
  })

  it('disables backspace when value is empty', () => {
    render(<PinPad value="" length={6} onKeyPress={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeDisabled()
  })

  it('disables every digit key when `disabled` is true', () => {
    render(<PinPad value="1" length={6} onKeyPress={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: 'PIN digit 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'PIN digit 9' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeDisabled()
  })

  it('applies the shake class when error toggles true', async () => {
    const { container, rerender } = render(
      <PinPad value="123" length={6} onKeyPress={vi.fn()} error={false} />,
    )
    expect(container.querySelector('.pin-pad--shake')).toBeNull()

    rerender(<PinPad value="123" length={6} onKeyPress={vi.fn()} error />)
    // The effect uses offsetWidth + classList — wait a tick for the DOM read.
    await Promise.resolve()
    expect(container.querySelector('.pin-pad--shake')).not.toBeNull()
  })

  it('renders all ten digit buttons plus the backspace key', () => {
    render(<PinPad value="" length={6} onKeyPress={vi.fn()} />)
    for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(screen.getByRole('button', { name: `PIN digit ${d}` })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeInTheDocument()
  })

  it('has the keypad group exposed for screen readers', () => {
    render(<PinPad value="" length={6} onKeyPress={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'PIN keypad' })).toBeInTheDocument()
  })
})
