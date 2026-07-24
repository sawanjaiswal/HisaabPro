/** Cash Register — Keypad: 4×4 grid, pure presentational */

import { KEYPAD_ROWS } from '../cashRegister.constants'
import type { ExpressionAction } from '../cashRegister.types'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  onKey: (action: ExpressionAction) => void
  disabled?: boolean
}

function getAction(key: string): ExpressionAction | null {
  if (key === 'C') return { type: 'CLEAR' }
  if (key === '⌫') return { type: 'BACKSPACE' }
  if (key === '+' || key === '-' || key === '*' || key === '/') {
    return { type: 'APPEND_OPERATOR', op: key }
  }
  if (key === '(' || key === ')') return { type: 'APPEND_PAREN', which: key }
  // digit or decimal
  return { type: 'APPEND_DIGIT', digit: key }
}

function keyClass(key: string): string {
  const base = 'cr-keypad__key'
  if (key === 'C') return `${base} cr-keypad__key--clear`
  if (key === '+' || key === '-' || key === '*' || key === '/') return `${base} cr-keypad__key--op`
  if (key === '⌫') return `${base} cr-keypad__key--back`
  return base
}

export function Keypad({ onKey, disabled }: Props) {
  const { t } = useLanguage()
  const KEY_LABELS: Record<string, string> = {
    'C':  t.cashRegKeyClear,
    '⌫':  t.cashRegKeyBackspace,
    '+':  t.cashRegKeyAdd,
    '-':  t.cashRegKeySubtract,
    '*':  t.cashRegKeyMultiply,
    '/':  t.cashRegKeyDivide,
    '.':  t.cashRegKeyDecimal,
  }
  const keyAriaLabel = (key: string): string => KEY_LABELS[key] ?? key

  const handleKey = (key: string) => {
    const action = getAction(key)
    if (action) onKey(action)
  }

  return (
    <div className="cr-keypad" role="group" aria-label={t.cashRegKeypadAria}>
      {KEYPAD_ROWS.map((row, ri) => (
        <div key={ri} className="cr-keypad__row">
          {row.map((key) => (
            <Button variant="none"
              key={key}
              type="button"
              className={keyClass(key)}
              onClick={() => handleKey(key)}
              disabled={disabled}
              aria-label={keyAriaLabel(key)}
            >
              {key}
            </Button>
          ))}
        </div>
      ))}
      {/* Backspace row (extra row below main grid) */}
      <div className="cr-keypad__row cr-keypad__row--extra">
        <Button variant="none"
          type="button"
          className="cr-keypad__key cr-keypad__key--back cr-keypad__key--wide"
          onClick={() => onKey({ type: 'BACKSPACE' })}
          disabled={disabled}
          aria-label={t.cashRegKeyBackspace}
        >
          ⌫
        </Button>
      </div>
    </div>
  )
}
