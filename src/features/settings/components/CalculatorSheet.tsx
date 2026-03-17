import React, { useState } from 'react'
import type { CalculatorState, CalculatorSettings } from '../settings.types'
import { CalculatorHeader } from './CalculatorHeader'
import { CalculatorDisplay } from './CalculatorDisplay'
import { CalculatorGstPanel } from './CalculatorGstPanel'
import { CalculatorKeypad } from './CalculatorKeypad'
import '../calculator.css'
import '../calculator-display.css'
import '../calculator-controls.css'
import '../calculator-keypad.css'

interface CalculatorSheetProps {
  state: CalculatorState
  settings: CalculatorSettings
  onPressKey: (key: string) => void
  onPressOperator: (op: string) => void
  onPressEquals: () => void
  onPressClear: () => void
  onPressBackspace: () => void
  onPressPercent: () => void
  onSetGstRate: (rate: number) => void
  onToggleGstMode: () => void
  onPressGT: () => void
  onPressMU: () => void
  onApplyPercentPreset: (percent: number, direction: 'add' | 'subtract') => void
  onApplyGstPreset: (direction: 'add' | 'subtract') => void
  onCashIn: () => void
  onCashOut: () => void
  onPaste: () => void
  onCopy: () => void
  onToggleSound: () => void
  onToggleVibration: () => void
  onClose: () => void
}

export const CalculatorSheet: React.FC<CalculatorSheetProps> = ({
  state,
  settings,
  onPressKey,
  onPressOperator,
  onPressEquals,
  onPressClear,
  onPressBackspace,
  onPressPercent,
  onSetGstRate,
  onToggleGstMode,
  onPressGT,
  onPressMU,
  onApplyPercentPreset,
  onApplyGstPreset,
  onCashIn,
  onCashOut,
  onPaste,
  onCopy,
  onToggleSound,
  onToggleVibration,
  onClose,
}) => {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="calculator-sheet" role="dialog" aria-label="Calculator" aria-modal="true">
      <CalculatorHeader
        settings={settings}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((p) => !p)}
        onToggleSound={onToggleSound}
        onToggleVibration={onToggleVibration}
        onClose={onClose}
      />

      <CalculatorDisplay state={state} />

      <CalculatorGstPanel
        state={state}
        onSetGstRate={onSetGstRate}
        onToggleGstMode={onToggleGstMode}
      />

      <CalculatorKeypad
        onPressKey={onPressKey}
        onPressOperator={onPressOperator}
        onPressEquals={onPressEquals}
        onPressClear={onPressClear}
        onPressBackspace={onPressBackspace}
        onPressPercent={onPressPercent}
        onPressGT={onPressGT}
        onPressMU={onPressMU}
        onApplyPercentPreset={onApplyPercentPreset}
        onApplyGstPreset={onApplyGstPreset}
        onCashIn={onCashIn}
        onCashOut={onCashOut}
        onPaste={onPaste}
        onCopy={onCopy}
      />
    </div>
  )
}
