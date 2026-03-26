import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { CalculatorState } from '../settings.types'

interface CalculatorDisplayProps {
  state: Pick<CalculatorState, 'display' | 'expression' | 'muBase'>
}

export const CalculatorDisplay: React.FC<CalculatorDisplayProps> = ({ state }) => {
  const { t } = useLanguage()

  return (
  <div className="calculator-display" aria-live="polite" aria-label={`${t.calculatorDisplayLabel}: ${state.display}`}>
    {state.muBase !== null && (
      <span className="calculator-mu-indicator" aria-hidden="true">{t.muEnterMargin}</span>
    )}
    {state.expression && (
      <span className="calculator-expression" aria-hidden="true">{state.expression}</span>
    )}
    <span className="calculator-result">{state.display}</span>
  </div>
)
}