import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { X, Settings, Volume2, VolumeX, Smartphone } from 'lucide-react'
import type { CalculatorSettings } from '../settings.types'

interface CalculatorHeaderProps {
  settings: CalculatorSettings
  showSettings: boolean
  onToggleSettings: () => void
  onToggleSound: () => void
  onToggleVibration: () => void
  onClose: () => void
}

export const CalculatorHeader: React.FC<CalculatorHeaderProps> = ({
  settings,
  showSettings,
  onToggleSettings,
  onToggleSound,
  onToggleVibration,
  onClose,
}) => {
  const { t } = useLanguage()

  return (
  <>
    <div className="calculator-header">
      <span className="calculator-header-title">{t.calculator}</span>
      <div className="calculator-header-actions">
        <button
          className="calculator-close-btn"
          onClick={onToggleSettings}
          aria-label={t.calculatorSettingsLabel}
        >
          <Settings size={16} aria-hidden="true" />
        </button>
        <button
          className="calculator-close-btn"
          onClick={onClose}
          aria-label={t.closeCalculatorLabel}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>

    {showSettings && (
      <div className="calculator-settings-panel">
        <button
          className="calculator-settings-row"
          onClick={onToggleSound}
          aria-label={`${t.keyboardSoundOnOff} ${settings.keyboardSound ? t.onLabel : t.offLabel}`}
        >
          {settings.keyboardSound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
          <span className="calculator-settings-label">{t.keyboardSoundLabel}</span>
          <span className={`calculator-settings-toggle${settings.keyboardSound ? ' calculator-settings-toggle--on' : ''}`} aria-hidden="true">
            <span className="calculator-settings-toggle-knob" />
          </span>
        </button>
        <button
          className="calculator-settings-row"
          onClick={onToggleVibration}
          aria-label={`${t.vibrationOnOff} ${settings.keyboardVibration ? t.onLabel : t.offLabel}`}
        >
          <Smartphone size={16} aria-hidden="true" />
          <span className="calculator-settings-label">{t.vibrationLabel}</span>
          <span className={`calculator-settings-toggle${settings.keyboardVibration ? ' calculator-settings-toggle--on' : ''}`} aria-hidden="true">
            <span className="calculator-settings-toggle-knob" />
          </span>
        </button>
      </div>
    )}
  </>
)
}