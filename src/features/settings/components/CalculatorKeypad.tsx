import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Delete, Clipboard, Copy } from 'lucide-react'
import { PERCENT_PRESETS } from '../calculator.constants'
import { Button } from '@/components/ui/Button'

const DIGIT_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'] as const
const OPERATOR_MAP: Record<string, string> = {
  '\u00f7': '/',
  '\u00d7': '*',
  '\u2212': '-',
  '+': '+',
}

interface CalculatorKeypadProps {
  onPressKey: (key: string) => void
  onPressOperator: (op: string) => void
  onPressEquals: () => void
  onPressClear: () => void
  onPressBackspace: () => void
  onPressPercent: () => void
  onPressGT: () => void
  onPressMU: () => void
  onApplyPercentPreset: (percent: number, direction: 'add' | 'subtract') => void
  onApplyGstPreset: (direction: 'add' | 'subtract') => void
  onCashIn: () => void
  onCashOut: () => void
  onPaste: () => void
  onCopy: () => void
}

export const CalculatorKeypad: React.FC<CalculatorKeypadProps> = ({
  onPressKey,
  onPressOperator,
  onPressEquals,
  onPressClear,
  onPressBackspace,
  onPressPercent,
  onPressGT,
  onPressMU,
  onApplyPercentPreset,
  onApplyGstPreset,
  onCashIn,
  onCashOut,
  onPaste,
  onCopy,
}) => {
  const { t } = useLanguage()

  return (
  <>
    {/* Function row: GT, MU, Cash IN, Cash OUT */}
    <div className="calculator-fn-row" role="group" aria-label={t.functionsLabel}>
      <Button variant="none" className="calculator-fn-btn" onClick={onPressGT} aria-label={t.grandTotalLabel}>GT</Button>
      <Button variant="none" className="calculator-fn-btn" onClick={onPressMU} aria-label={t.markupLabel}>MU</Button>
      <Button variant="none" className="calculator-fn-btn calculator-fn-btn--cash-in" onClick={onCashIn} aria-label={t.cashInLabel}>{t.cashInLabel}</Button>
      <Button variant="none" className="calculator-fn-btn calculator-fn-btn--cash-out" onClick={onCashOut} aria-label={t.cashOutLabel}>{t.cashOutLabel}</Button>
    </div>

    {/* +Percentage row */}
    <div className="calculator-pct-row" role="group" aria-label={t.addPercentageLabel}>
      {PERCENT_PRESETS.map((pct) => (
        <Button variant="none"
          key={`add-${pct}`}
          className="calculator-pct-btn calculator-pct-btn--add"
          onClick={() => onApplyPercentPreset(pct, 'add')}
          aria-label={`Add ${pct} percent`}
        >
          +{pct}%
        </Button>
      ))}
      <Button variant="none"
        className="calculator-pct-btn calculator-pct-btn--add calculator-pct-btn--gst"
        onClick={() => onApplyGstPreset('add')}
        aria-label={t.addGstLabel}
      >
        +GST
      </Button>
    </div>

    {/* -Percentage row */}
    <div className="calculator-pct-row" role="group" aria-label={t.subtractPercentageLabel}>
      {PERCENT_PRESETS.map((pct) => (
        <Button variant="none"
          key={`sub-${pct}`}
          className="calculator-pct-btn calculator-pct-btn--sub"
          onClick={() => onApplyPercentPreset(pct, 'subtract')}
          aria-label={`Subtract ${pct} percent`}
        >
          -{pct}%
        </Button>
      ))}
      <Button variant="none"
        className="calculator-pct-btn calculator-pct-btn--sub calculator-pct-btn--gst"
        onClick={() => onApplyGstPreset('subtract')}
        aria-label={t.subtractGstLabel}
      >
        -GST
      </Button>
    </div>

    {/* Keypad */}
    <div className="calculator-keypad-area">
      <div className="calculator-keypad" role="group" aria-label={t.calculatorKeypadLabel}>
        <Button variant="none" className="calculator-key calculator-key--clear" onClick={onPressClear} aria-label={t.clearKeyLabel}>C</Button>
        <Button variant="none" className="calculator-key calculator-key--operator" onClick={onPressBackspace} aria-label={t.backspaceKeyLabel}>
          <Delete size={18} aria-hidden="true" />
        </Button>
        <Button variant="none" className="calculator-key calculator-key--operator" onClick={onPressPercent} aria-label={t.percentKeyLabel}>%</Button>
        <Button variant="none" className="calculator-key calculator-key--operator" onClick={() => onPressOperator(OPERATOR_MAP['\u00f7'])} aria-label={t.divideKeyLabel}>&divide;</Button>

        {DIGIT_KEYS.slice(0, 3).map((d) => (
          <Button variant="none" key={d} className="calculator-key" onClick={() => onPressKey(d)} aria-label={d}>{d}</Button>
        ))}
        <Button variant="none" className="calculator-key calculator-key--operator" onClick={() => onPressOperator(OPERATOR_MAP['\u00d7'])} aria-label={t.multiplyKeyLabel}>&times;</Button>

        {DIGIT_KEYS.slice(3, 6).map((d) => (
          <Button variant="none" key={d} className="calculator-key" onClick={() => onPressKey(d)} aria-label={d}>{d}</Button>
        ))}
        <Button variant="none" className="calculator-key calculator-key--operator" onClick={() => onPressOperator(OPERATOR_MAP['\u2212'])} aria-label={t.subtractKeyLabel}>&minus;</Button>

        {DIGIT_KEYS.slice(6, 9).map((d) => (
          <Button variant="none" key={d} className="calculator-key" onClick={() => onPressKey(d)} aria-label={d}>{d}</Button>
        ))}
        <Button variant="none" className="calculator-key calculator-key--operator" onClick={() => onPressOperator('+')} aria-label={t.addKeyLabel}>+</Button>

        <Button variant="none" className="calculator-key" onClick={() => onPressKey('00')} aria-label={t.doubleZeroKeyLabel}>00</Button>
        <Button variant="none" className="calculator-key" onClick={() => onPressKey('0')} aria-label={t.zeroKeyLabel}>0</Button>
        <Button variant="none" className="calculator-key" onClick={() => onPressKey('.')} aria-label={t.decimalPointKeyLabel}>.</Button>
        <Button variant="none" className="calculator-key calculator-key--equals" onClick={onPressEquals} aria-label={t.equalsKeyLabel}>=</Button>
      </div>
    </div>

    {/* Bottom actions */}
    <div className="calculator-actions">
      <Button variant="none" className="calculator-action-btn" onClick={onPaste} aria-label={t.pasteToFieldLabel}>
        <Clipboard size={16} aria-hidden="true" />
        {t.pasteLabel}
      </Button>
      <Button variant="none" className="calculator-action-btn calculator-action-btn--primary" onClick={onCopy} aria-label={t.copyResultLabel}>
        <Copy size={16} aria-hidden="true" />
        {t.copyLabel}
      </Button>
    </div>
  </>
)
}
