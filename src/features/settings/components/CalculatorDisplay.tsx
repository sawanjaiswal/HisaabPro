import React from 'react'
import type { CalculatorState } from '../settings.types'

interface CalculatorDisplayProps {
  state: Pick<CalculatorState, 'display' | 'expression' | 'muBase'>
}

export const CalculatorDisplay: React.FC<CalculatorDisplayProps> = ({ state }) => (
  <div className="calculator-display" aria-live="polite" aria-label={`Calculator display: ${state.display}`}>
    {state.muBase !== null && (
      <span className="calculator-mu-indicator" aria-hidden="true">MU: Enter margin %</span>
    )}
    {state.expression && (
      <span className="calculator-expression" aria-hidden="true">{state.expression}</span>
    )}
    <span className="calculator-result">{state.display}</span>
  </div>
)
