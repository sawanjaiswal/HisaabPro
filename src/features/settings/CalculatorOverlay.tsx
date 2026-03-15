import { Calculator } from 'lucide-react'
import type { CalculatorPosition } from './settings.types'
import { useCalculator } from './useCalculator'
import { CalculatorSheet } from './components/CalculatorSheet'
import './settings.css'

const VALID_OPERATORS = new Set(['+', '-', '*', '/'])

interface CalculatorOverlayProps {
  /** Derived from app settings — controls which side of the screen the FAB appears */
  position?: CalculatorPosition
}

export function CalculatorOverlay({
  position = 'BOTTOM_RIGHT',
}: CalculatorOverlayProps) {
  const {
    state,
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
    pasteToField,
    copyToClipboard,
  } = useCalculator()

  /**
   * `CalculatorSheet.onPressOperator` is typed `(op: string) => void` to keep
   * the component generic, but `useCalculator.pressOperator` accepts only the
   * four arithmetic operators.  We validate here at the boundary.
   */
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
        aria-label={isOpen ? 'Close calculator' : 'Open calculator'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Calculator size={24} aria-hidden="true" />
      </button>

      {/* Overlay + bottom sheet — only when open */}
      {isOpen && (
        <div
          className="calculator-overlay"
          role="presentation"
          onClick={(e) => {
            // Close when clicking the backdrop (not the sheet itself)
            if (e.target === e.currentTarget) toggle()
          }}
        >
          <CalculatorSheet
            state={state}
            onPressKey={pressKey}
            onPressOperator={handlePressOperator}
            onPressEquals={pressEquals}
            onPressClear={pressClear}
            onPressBackspace={pressBackspace}
            onPressPercent={pressPercent}
            onSetGstRate={setGstRate}
            onToggleGstMode={toggleGstMode}
            onPaste={pasteToField}
            onCopy={copyToClipboard}
            onClose={toggle}
          />
        </div>
      )}
    </>
  )
}
