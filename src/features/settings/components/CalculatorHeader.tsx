import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { X, Settings, Volume2, VolumeX, Smartphone } from 'lucide-react'
import type { CalculatorSettings } from '../settings.types'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'

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
        <Button variant="none"
          className="calculator-close-btn"
          onClick={onToggleSettings}
          aria-label={t.calculatorSettingsLabel}
        >
          <Settings size={16} aria-hidden="true" />
        </Button>
        <Button variant="none"
          className="calculator-close-btn"
          onClick={onClose}
          aria-label={t.closeCalculatorLabel}
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>

    {showSettings && (
      <div className="calculator-settings-panel py-0">
        <div
          className="calculator-settings-row flex items-center justify-between cursor-pointer"
          onClick={onToggleSound}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleSound()
            }
          }}
          aria-label={`${t.keyboardSoundOnOff} ${settings.keyboardSound ? t.onLabel : t.offLabel}`}
        >
          <div className="flex items-center gap-2">
            {settings.keyboardSound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            <span className="calculator-settings-label">{t.keyboardSoundLabel}</span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              size="sm"
              checked={settings.keyboardSound}
              onCheckedChange={onToggleSound}
              ariaLabel={t.keyboardSoundLabel}
            />
          </div>
        </div>
        <div
          className="calculator-settings-row flex items-center justify-between cursor-pointer"
          onClick={onToggleVibration}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleVibration()
            }
          }}
          aria-label={`${t.vibrationOnOff} ${settings.keyboardVibration ? t.onLabel : t.offLabel}`}
        >
          <div className="flex items-center gap-2">
            <Smartphone size={16} aria-hidden="true" />
            <span className="calculator-settings-label">{t.vibrationLabel}</span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              size="sm"
              checked={settings.keyboardVibration}
              onCheckedChange={onToggleVibration}
              ariaLabel={t.vibrationLabel}
            />
          </div>
        </div>
      </div>
    )}
  </>
)
}
