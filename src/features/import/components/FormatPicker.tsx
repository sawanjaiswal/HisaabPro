/**
 * Phase 7 Slice 7.1A — Format picker.
 * Grid of cards (2x2 on mobile, 4x1 on >=md). Each card is the
 * "choose source" tap target.
 */

import { FileText, FileSpreadsheet, FileCode, FileJson } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { FORMAT_OPTIONS } from '../constants/import.constants'
import type { ImportFormat } from '../types/import.types'

interface FormatPickerProps {
  value: ImportFormat | null
  onChange: (next: ImportFormat) => void
  disabled?: boolean
}

const ICON_BY_FORMAT: Record<ImportFormat, typeof FileText> = {
  tally_xml: FileCode,
  vyapar_csv: FileText,
  busy_xls: FileSpreadsheet,
  generic_csv: FileJson,
}

export function FormatPicker({ value, onChange, disabled = false }: FormatPickerProps) {
  const { t } = useLanguage()
  const tx = t as unknown as Record<string, string>

  return (
    <div
      role="radiogroup"
      aria-label={tx.importPickFormatLabel ?? 'Source format'}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {FORMAT_OPTIONS.map((opt) => {
        const Icon = ICON_BY_FORMAT[opt.value]
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={
              'text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)] rounded-[var(--radius-xl)]' +
              (disabled ? ' opacity-60 cursor-not-allowed' : '')
            }
          >
            <Card
              variant="default"
              elevated={selected}
              className={
                'h-full p-4 min-h-[112px] flex flex-col gap-2 border-2 ' +
                (selected
                  ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]'
                  : 'border-transparent')
              }
            >
              <Icon
                className="w-5 h-5"
                style={{ color: 'var(--color-primary-600)' }}
                aria-hidden="true"
              />
              <span
                className="font-semibold"
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
              >
                {tx[opt.labelKey] ?? opt.value}
              </span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                {tx[opt.descKey] ?? ''}
              </span>
            </Card>
          </button>
        )
      })}
    </div>
  )
}
