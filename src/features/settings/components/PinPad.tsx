import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Fingerprint, Delete } from 'lucide-react'
import '../pin-setup.css'
import { Button } from '@/components/ui/Button'

interface PinPadProps {
  length: number
  value: string
  onKeyPress: (digit: string) => void
  onBackspace: () => void
  onBiometric?: () => void
  error?: string
  title: string
  subtitle?: string
}

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const

const KEY_SUBTEXT: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
}

export const PinPad: React.FC<PinPadProps> = ({
  length,
  value,
  onKeyPress,
  onBackspace,
  onBiometric,
  error,
  title,
  subtitle,
}) => {
  const { t } = useLanguage()

  return (
    <div className="pin-screen">
      <div className="pin-header">
        <h2 className="pin-title">{title}</h2>
        {subtitle && <p className="pin-subtitle">{subtitle}</p>}
      </div>

      <div
        className={`pin-dots${error ? ' pin-error' : ''}`}
        role="status"
        aria-label={`${value.length} ${t.ofWord} ${length} ${t.digitsEntered}${error ? '. ' + error : ''}`}
        aria-live="polite"
      >
        {Array.from({ length }, (_, i) => (
          <span
            key={`dot-${i}`}
            className={`pin-dot${i < value.length ? (error ? ' pin-dot--error' : ' pin-dot--filled') : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {error && (
        <p className="pin-error-text" role="alert">{error}</p>
      )}

      <div className="pin-keypad" role="group" aria-label={t.pinKeypadLabel}>
        {DIGIT_ROWS.map((row) =>
          row.map((digit) => (
            <Button variant="none"
              key={digit}
              className="pin-key"
              onClick={() => onKeyPress(digit)}
              aria-label={digit}
              disabled={value.length >= length}
            >
              {digit}
              {KEY_SUBTEXT[digit] && (
                <span className="pin-key-sub" aria-hidden="true">{KEY_SUBTEXT[digit]}</span>
              )}
            </Button>
          ))
        )}

        {/* Bottom row: biometric | 0 | backspace */}
        {onBiometric ? (
          <Button variant="none"
            className="pin-key pin-key-special"
            onClick={onBiometric}
            aria-label={t.useBiometricLabel}
          >
            <Fingerprint size={24} aria-hidden="true" />
          </Button>
        ) : (
          <span className="pin-key pin-key--empty" aria-hidden="true" />
        )}

        <Button variant="none"
          className="pin-key"
          onClick={() => onKeyPress('0')}
          aria-label="0"
          disabled={value.length >= length}
        >
          0
        </Button>

        <Button variant="none"
          className="pin-key pin-key-special"
          onClick={onBackspace}
          aria-label={t.deleteLastDigit}
          disabled={value.length === 0}
        >
          <Delete size={22} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
