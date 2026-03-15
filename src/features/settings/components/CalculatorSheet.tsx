import React from 'react'
import { X, Delete, Clipboard, Copy } from 'lucide-react'
import type { CalculatorState } from '../settings.types'
import { GST_RATES } from '../settings.constants'
import { calculateGst } from '../settings.utils'
import '../settings.css'

interface CalculatorSheetProps {
  state: CalculatorState
  onPressKey: (key: string) => void
  onPressOperator: (op: string) => void
  onPressEquals: () => void
  onPressClear: () => void
  onPressBackspace: () => void
  onPressPercent: () => void
  onSetGstRate: (rate: number) => void
  onToggleGstMode: () => void
  onPaste: () => void
  onCopy: () => void
  onClose: () => void
}

const DIGIT_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'] as const
const OPERATOR_MAP: Record<string, string> = {
  '\u00f7': '/',
  '\u00d7': '*',
  '\u2212': '-',
  '+': '+',
}

export const CalculatorSheet: React.FC<CalculatorSheetProps> = ({
  state,
  onPressKey,
  onPressOperator,
  onPressEquals,
  onPressClear,
  onPressBackspace,
  onPressPercent,
  onSetGstRate,
  onToggleGstMode,
  onPaste,
  onCopy,
  onClose,
}) => {
  const currentValue = state.result ?? parseFloat(state.display) ?? 0
  const gstBreakdown =
    state.mode === 'gst' && state.gstRate !== null && !Number.isNaN(currentValue)
      ? calculateGst(currentValue, state.gstRate, state.gstMode)
      : null

  return (
    <div className="calculator-sheet" role="dialog" aria-label="Calculator" aria-modal="true">
      <div className="calculator-handle" aria-hidden="true" />

      {/* Header close */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1)', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gray-500)' }}
          aria-label="Close calculator"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Display */}
      <div className="calculator-display" aria-live="polite" aria-label={`Calculator display: ${state.display}`}>
        {state.expression && (
          <span className="calculator-expression" aria-hidden="true">{state.expression}</span>
        )}
        <span className="calculator-result">{state.display}</span>
      </div>

      {/* GST row */}
      <div className="calculator-gst-row" role="group" aria-label="GST rate selection">
        {GST_RATES.map((rate) => (
          <button
            key={rate}
            className={`calculator-gst-chip${state.gstRate === rate && state.mode === 'gst' ? ' calculator-gst-chip--active' : ''}`}
            onClick={() => onSetGstRate(rate)}
            aria-label={`GST ${rate}%`}
            aria-pressed={state.gstRate === rate && state.mode === 'gst'}
          >
            {rate}%
          </button>
        ))}
        {state.mode === 'gst' && (
          <button
            className="calculator-gst-chip calculator-gst-chip--mode"
            onClick={onToggleGstMode}
            aria-label={`Switch to ${state.gstMode === 'exclusive' ? 'inclusive' : 'exclusive'} GST`}
          >
            {state.gstMode === 'exclusive' ? '+ GST' : 'Incl. GST'}
          </button>
        )}
      </div>

      {/* GST breakdown */}
      {gstBreakdown && (
        <div className="calculator-gst-breakdown" role="region" aria-label="GST breakdown">
          <div className="calculator-gst-item">
            <span className="calculator-gst-item-label">Base</span>
            <span className="calculator-gst-item-value">{gstBreakdown.base.toLocaleString('en-IN')}</span>
          </div>
          <div className="calculator-gst-item">
            <span className="calculator-gst-item-label">GST</span>
            <span className="calculator-gst-item-value">{gstBreakdown.gst.toLocaleString('en-IN')}</span>
          </div>
          <div className="calculator-gst-item">
            <span className="calculator-gst-item-label">Total</span>
            <span className="calculator-gst-item-value">{gstBreakdown.total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Keypad */}
      <div className="calculator-keypad" role="group" aria-label="Calculator keypad">
        {/* Row 1: C, backspace, %, operator */}
        <button className="calculator-key calculator-key--clear" onClick={onPressClear} aria-label="Clear">C</button>
        <button className="calculator-key calculator-key--operator" onClick={onPressBackspace} aria-label="Backspace">
          <Delete size={18} aria-hidden="true" />
        </button>
        <button className="calculator-key calculator-key--operator" onClick={onPressPercent} aria-label="Percent">%</button>
        <button className="calculator-key calculator-key--operator" onClick={() => onPressOperator(OPERATOR_MAP['\u00f7'])} aria-label="Divide">&divide;</button>

        {/* Rows 2-4: digits + operators */}
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

        {/* Row 5: 00, 0, ., = */}
        <button className="calculator-key" onClick={() => onPressKey('00')} aria-label="Double zero">00</button>
        <button className="calculator-key" onClick={() => onPressKey('0')} aria-label="Zero">0</button>
        <button className="calculator-key" onClick={() => onPressKey('.')} aria-label="Decimal point">.</button>
        <button className="calculator-key calculator-key--equals" onClick={onPressEquals} aria-label="Equals">=</button>
      </div>

      {/* Bottom actions */}
      <div className="calculator-actions">
        <button className="calculator-action-btn" onClick={onPaste} aria-label="Paste value to field">
          <Clipboard size={16} aria-hidden="true" />
          Paste to field
        </button>
        <button className="calculator-action-btn calculator-action-btn--primary" onClick={onCopy} aria-label="Copy result">
          <Copy size={16} aria-hidden="true" />
          Copy
        </button>
      </div>
    </div>
  )
}
