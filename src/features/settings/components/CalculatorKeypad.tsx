import React from 'react'
import { Delete, Clipboard, Copy } from 'lucide-react'
import { PERCENT_PRESETS } from '../calculator.constants'

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
}) => (
  <>
    {/* Function row: GT, MU, Cash IN, Cash OUT */}
    <div className="calculator-fn-row" role="group" aria-label="Functions">
      <button className="calculator-fn-btn" onClick={onPressGT} aria-label="Grand Total">GT</button>
      <button className="calculator-fn-btn" onClick={onPressMU} aria-label="Markup">MU</button>
      <button className="calculator-fn-btn calculator-fn-btn--cash-in" onClick={onCashIn} aria-label="Cash In">Cash IN</button>
      <button className="calculator-fn-btn calculator-fn-btn--cash-out" onClick={onCashOut} aria-label="Cash Out">Cash OUT</button>
    </div>

    {/* +Percentage row */}
    <div className="calculator-pct-row" role="group" aria-label="Add percentage">
      {PERCENT_PRESETS.map((pct) => (
        <button
          key={`add-${pct}`}
          className="calculator-pct-btn calculator-pct-btn--add"
          onClick={() => onApplyPercentPreset(pct, 'add')}
          aria-label={`Add ${pct} percent`}
        >
          +{pct}%
        </button>
      ))}
      <button
        className="calculator-pct-btn calculator-pct-btn--add calculator-pct-btn--gst"
        onClick={() => onApplyGstPreset('add')}
        aria-label="Add GST"
      >
        +GST
      </button>
    </div>

    {/* -Percentage row */}
    <div className="calculator-pct-row" role="group" aria-label="Subtract percentage">
      {PERCENT_PRESETS.map((pct) => (
        <button
          key={`sub-${pct}`}
          className="calculator-pct-btn calculator-pct-btn--sub"
          onClick={() => onApplyPercentPreset(pct, 'subtract')}
          aria-label={`Subtract ${pct} percent`}
        >
          -{pct}%
        </button>
      ))}
      <button
        className="calculator-pct-btn calculator-pct-btn--sub calculator-pct-btn--gst"
        onClick={() => onApplyGstPreset('subtract')}
        aria-label="Subtract GST"
      >
        -GST
      </button>
    </div>

    {/* Keypad */}
    <div className="calculator-keypad-area">
      <div className="calculator-keypad" role="group" aria-label="Calculator keypad">
        <button className="calculator-key calculator-key--clear" onClick={onPressClear} aria-label="Clear">C</button>
        <button className="calculator-key calculator-key--operator" onClick={onPressBackspace} aria-label="Backspace">
          <Delete size={18} aria-hidden="true" />
        </button>
        <button className="calculator-key calculator-key--operator" onClick={onPressPercent} aria-label="Percent">%</button>
        <button className="calculator-key calculator-key--operator" onClick={() => onPressOperator(OPERATOR_MAP['\u00f7'])} aria-label="Divide">&divide;</button>

        {DIGIT_KEYS.slice(0, 3).map((d) => (
          <button key={d} className="calculator-key" onClick={() => onPressKey(d)} aria-label={d}>{d}</button>
        ))}
        <button className="calculator-key calculator-key--operator" onClick={() => onPressOperator(OPERATOR_MAP['\u00d7'])} aria-label="Multiply">&times;</button>

        {DIGIT_KEYS.slice(3, 6).map((d) => (
          <button key={d} className="calculator-key" onClick={() => onPressKey(d)} aria-label={d}>{d}</button>
        ))}
        <button className="calculator-key calculator-key--operator" onClick={() => onPressOperator(OPERATOR_MAP['\u2212'])} aria-label="Subtract">&minus;</button>

        {DIGIT_KEYS.slice(6, 9).map((d) => (
          <button key={d} className="calculator-key" onClick={() => onPressKey(d)} aria-label={d}>{d}</button>
        ))}
        <button className="calculator-key calculator-key--operator" onClick={() => onPressOperator('+')} aria-label="Add">+</button>

        <button className="calculator-key" onClick={() => onPressKey('00')} aria-label="Double zero">00</button>
        <button className="calculator-key" onClick={() => onPressKey('0')} aria-label="Zero">0</button>
        <button className="calculator-key" onClick={() => onPressKey('.')} aria-label="Decimal point">.</button>
        <button className="calculator-key calculator-key--equals" onClick={onPressEquals} aria-label="Equals">=</button>
      </div>
    </div>

    {/* Bottom actions */}
    <div className="calculator-actions">
      <button className="calculator-action-btn" onClick={onPaste} aria-label="Paste value to field">
        <Clipboard size={16} aria-hidden="true" />
        Paste
      </button>
      <button className="calculator-action-btn calculator-action-btn--primary" onClick={onCopy} aria-label="Copy result">
        <Copy size={16} aria-hidden="true" />
        Copy
      </button>
    </div>
  </>
)
