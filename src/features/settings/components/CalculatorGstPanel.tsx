import React, { useRef, useEffect, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { CalculatorState } from '../settings.types'
import { GST_RATES } from '../calculator.constants'

interface CalculatorGstPanelProps {
  state: Pick<CalculatorState, 'mode' | 'gstRate' | 'gstMode' | 'lastGstBreakdown'>
  onSetGstRate: (rate: number) => void
  onToggleGstMode: () => void
}

export const CalculatorGstPanel: React.FC<CalculatorGstPanelProps> = ({
  state,
  onSetGstRate,
  onToggleGstMode,
}) => {
  const { t } = useLanguage()
  const gstBarRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({})
  const isGstMode = state.mode === 'gst'
  const breakdown = state.lastGstBreakdown

  useEffect(() => {
    if (!gstBarRef.current || !state.gstRate) return
    const idx = GST_RATES.indexOf(state.gstRate as typeof GST_RATES[number])
    if (idx === -1) return
    const buttons = gstBarRef.current.querySelectorAll<HTMLButtonElement>('.calc-gst-rate-btn')
    const btn = buttons[idx]
    if (!btn) return
    const bar = gstBarRef.current.getBoundingClientRect()
    const rect = btn.getBoundingClientRect()
    setIndicatorStyle({
      left: rect.left - bar.left,
      width: rect.width,
    })
  }, [state.gstRate])

  return (
    <>
      <div className="calc-gst-panel py-0" role="group" aria-label={t.gstControlsLabel}>
        <div className="calc-gst-rate-bar" ref={gstBarRef}>
          {isGstMode && state.gstRate && (
            <div className="calc-gst-rate-indicator" style={indicatorStyle} aria-hidden="true" />
          )}
          {GST_RATES.map((rate) => (
            <button
              key={rate}
              className={`calc-gst-rate-btn${isGstMode && state.gstRate === rate ? ' calc-gst-rate-btn--active' : ''}`}
              onClick={() => onSetGstRate(rate)}
              aria-label={`${t.gstPercentLabel} ${rate} ${t.percentSuffix}`}
              aria-pressed={isGstMode && state.gstRate === rate}
            >
              <span className="calc-gst-rate-value">{rate}</span>
              <span className="calc-gst-rate-suffix">%</span>
            </button>
          ))}
        </div>
        <button
          className={`calc-gst-mode-toggle${isGstMode ? ' calc-gst-mode-toggle--active' : ''}`}
          onClick={onToggleGstMode}
          aria-label={`${t.gstModeLabel}: ${state.gstMode}`}
        >
          {state.gstMode === 'exclusive' ? t.gstExcl : t.gstIncl}
        </button>
      </div>

      {breakdown && (
        <div className="calculator-gst-breakdown" role="region" aria-label={t.gstBreakdownLabel}>
          <div className="calculator-gst-item">
            <span className="calculator-gst-item-label">{t.gstBaseLabel}</span>
            <span className="calculator-gst-item-value">
              <span className="calculator-gst-rupee" aria-hidden="true">{'\u20B9'}</span>
              {breakdown.base.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="calculator-gst-item calculator-gst-item--gst">
            <span className="calculator-gst-item-label">{t.gstLabelCalc}</span>
            <span className="calculator-gst-item-value">
              <span className="calculator-gst-rupee" aria-hidden="true">{'\u20B9'}</span>
              {breakdown.gst.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="calculator-gst-item">
            <span className="calculator-gst-item-label">{t.gstTotalLabel}</span>
            <span className="calculator-gst-item-value">
              <span className="calculator-gst-rupee" aria-hidden="true">{'\u20B9'}</span>
              {breakdown.total.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
