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
import { Button } from '@/components/ui/Button'

interface FormatPickerProps {
  value: ImportFormat | null
  onChange: (next: ImportFormat) => void
  disabled?: boolean
}

const ICON_BY_FORMAT: Record<ImportFormat, typeof FileText> = {
  TALLY_XML: FileCode,
  VYAPAR_CSV: FileText,
  BUSY_XLSX: FileSpreadsheet,
  GENERIC_CSV: FileJson,
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
          <Button variant="none"
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={
              'text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-xl' +
              (disabled ? ' opacity-60 cursor-not-allowed' : '')
            }
          >
            <Card
              variant="default"
              elevated={selected}
              className={
                'h-full p-4 min-h-[112px] flex flex-col gap-2 border-2 ' +
                (selected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-transparent')
              }
            >
              <Icon
                className="w-5 h-5"
                style={{ color: 'var(--color-primary-600)' }}
                aria-hidden="true"
              />
              <span
                className="font-semibold text-sm text-[var(--text-primary)] font-medium"
                
              >
                {tx[opt.labelKey] ?? opt.value}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {tx[opt.descKey] ?? ''}
              </span>
            </Card>
          </Button>
        )
      })}
    </div>
  )
}
