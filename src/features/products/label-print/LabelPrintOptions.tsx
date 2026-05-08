/** Label Print Options — format/template chips + qty steppers (sub-component) */

import { Minus, Plus } from 'lucide-react'
import type { LabelItem, LabelTemplate, SheetFormat } from './label-print.types'

const SHEET_OPTIONS: { value: SheetFormat; label: string }[] = [
  { value: 'THERMAL_40x30', label: 'Thermal 40×30mm' },
  { value: 'A4_3x8',        label: 'A4 — 24 per sheet' },
  { value: 'A5_2x5',        label: 'A5 — 10 per sheet' },
]

const TEMPLATE_OPTIONS: { value: LabelTemplate | 'per-product'; label: string }[] = [
  { value: 'per-product',  label: 'Per product' },
  { value: 'standard',     label: 'Standard' },
  { value: 'compact',      label: 'Compact' },
  { value: 'barcode-only', label: 'Barcode only' },
]

interface LabelPrintOptionsProps {
  items:        LabelItem[]
  sheetFormat:  SheetFormat
  templateOvr:  LabelTemplate | 'per-product'
  qtyMap:       Record<string, number>
  cellCount:    number
  pageCount:    number
  onSheetChange:    (v: SheetFormat) => void
  onTemplateChange: (v: LabelTemplate | 'per-product') => void
  onQtyChange:      (id: string, delta: number) => void
}

export function LabelPrintOptions({
  items,
  sheetFormat,
  templateOvr,
  qtyMap,
  cellCount,
  pageCount,
  onSheetChange,
  onTemplateChange,
  onQtyChange,
}: LabelPrintOptionsProps) {
  return (
    <>
      {/* Sheet format */}
      <section className="label-option-group" aria-label="Sheet format">
        <p className="label-option-label">Sheet format</p>
        <div className="label-chip-row" role="radiogroup" aria-label="Sheet format">
          {SHEET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={sheetFormat === opt.value}
              className={`label-chip${sheetFormat === opt.value ? ' label-chip--active' : ''}`}
              onClick={() => onSheetChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Template */}
      <section className="label-option-group" aria-label="Label style">
        <p className="label-option-label">Label style</p>
        <div className="label-chip-row" role="radiogroup" aria-label="Label style">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={templateOvr === opt.value}
              className={`label-chip${templateOvr === opt.value ? ' label-chip--active' : ''}`}
              onClick={() => onTemplateChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Qty steppers */}
      <section className="label-option-group" aria-label="Copies per product">
        <p className="label-option-label">Copies</p>
        <ul className="label-qty-list">
          {items.map((item) => (
            <li key={item.id} className="label-qty-row">
              <span className="label-qty-name">{item.name}</span>
              <div className="label-qty-stepper">
                <button
                  type="button"
                  className="label-qty-btn"
                  onClick={() => onQtyChange(item.id, -1)}
                  disabled={(qtyMap[item.id] ?? 1) <= 1}
                  aria-label={`Decrease quantity for ${item.name}`}
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span className="label-qty-value" aria-live="polite">
                  {qtyMap[item.id] ?? 1}
                </span>
                <button
                  type="button"
                  className="label-qty-btn"
                  onClick={() => onQtyChange(item.id, 1)}
                  disabled={(qtyMap[item.id] ?? 1) >= 99}
                  aria-label={`Increase quantity for ${item.name}`}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="label-count-text" aria-live="polite">
          {cellCount} label{cellCount !== 1 ? 's' : ''} on {pageCount} page{pageCount !== 1 ? 's' : ''}
        </p>
      </section>
    </>
  )
}
