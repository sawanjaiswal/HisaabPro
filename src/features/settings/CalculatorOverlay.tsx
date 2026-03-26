import { useEffect } from 'react'
import { Calculator } from 'lucide-react'
import type { CalculatorPosition } from './settings.types'
import { useLanguage } from '@/hooks/useLanguage'
import { useCalculator } from './useCalculator'
import { CalculatorSheet } from './components/CalculatorSheet'
import './calculator.css'

import { CALCULATOR_TOGGLE_EVENT } from '@/config/events.config'

const VALID_OPERATORS = new Set(['+', '-', '*', '/'])

// Re-export for backward compatibility
export { CALCULATOR_TOGGLE_EVENT }

interface CalculatorOverlayProps {
  /** Derived from app settings — controls which side of the screen the FAB appears */
  position?: CalculatorPosition
}

export function CalculatorOverlay({
  position = 'BOTTOM_RIGHT',
}: CalculatorOverlayProps) {
  const { t } = useLanguage()
  const {
    state,
    settings,
    isOpen,
    toggle,
    pressKey,
    pressOperator: pressOperatorRaw,
    pressEquals,
    pressClear,
    pressBackspace,
    pressPercent,
    setGstRate,
    toggleGstMode,
    pressGT,
    pressMU,
    applyPercentPreset,
    applyGstPreset,
    cashIn,
    cashOut,
    pasteToField,
    copyToClipboard,
    toggleSound,
    toggleVibration,
  } = useCalculator()

  // Listen for external toggle events (from dashboard header, etc.)
  useEffect(() => {
    const handler = () => toggle()
    window.addEventListener(CALCULATOR_TOGGLE_EVENT, handler)
    return () => window.removeEventListener(CALCULATOR_TOGGLE_EVENT, handler)
  }, [toggle])

  const handlePressOperator = (op: string): void => {
    if (VALID_OPERATORS.has(op)) {
      pressOperatorRaw(op as '+' | '-' | '*' | '/')
    }
  }

  const fabPositionClass =
    position === 'BOTTOM_LEFT' ? 'calculator-fab--left' : 'calculator-fab--right'

  return (
    <>
      {/* Floating action button — always visible */}
      <button
        type="button"
        className={`calculator-fab ${fabPositionClass}`}
        onClick={toggle}
        aria-label={isOpen ? t.closeCalculatorLabel : t.openCalculatorLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Calculator size={24} aria-hidden="true" />
      </button>

      {/* Full-height calculator — only when open */}
      {isOpen && (
        <div className="calculator-overlay" role="presentation">
          <CalculatorSheet
            state={state}
            settings={settings}
            onPressKey={pressKey}
            onPressOperator={handlePressOperator}
            onPressEquals={pressEquals}
            onPressClear={pressClear}
            onPressBackspace={pressBackspace}
            onPressPercent={pressPercent}
            onSetGstRate={setGstRate}
            onToggleGstMode={toggleGstMode}
            onPressGT={pressGT}
            onPressMU={pressMU}
            onApplyPercentPreset={applyPercentPreset}
            onApplyGstPreset={applyGstPreset}
            onCashIn={cashIn}
            onCashOut={cashOut}
            onPaste={pasteToField}
            onCopy={copyToClipboard}
            onToggleSound={toggleSound}
            onToggleVibration={toggleVibration}
            onClose={toggle}
          />
        </div>
      )}
    </>
  )
}
