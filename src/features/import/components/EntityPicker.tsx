/**
 * Phase 7 Slice 7.1B FE.B1 — Entity picker.
 *
 * Two cards: "Import parties" and "Import products". Sits above
 * <FormatPicker> on the upload page. Mirrors the FormatPicker visual
 * grammar (radiogroup of <Card> tiles) so the wizard reads as a single
 * three-step flow: 1) entity → 2) source format → 3) file.
 *
 * Token-only styling, ≥44px touch targets, focus rings via design tokens.
 */

import { Users, Package } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import type { ImportEntity } from '../types/import.types'

interface EntityPickerProps {
  value: ImportEntity | null
  onChange: (next: ImportEntity) => void
  disabled?: boolean
}

interface EntityOption {
  value: ImportEntity
  labelKey: string
  descKey: string
  Icon: typeof Users
}

const OPTIONS: readonly EntityOption[] = [
  { value: 'parties', labelKey: 'importEntityParties', descKey: 'importEntityPartiesDesc', Icon: Users },
  { value: 'product', labelKey: 'importEntityProducts', descKey: 'importEntityProductsDesc', Icon: Package },
] as const

export function EntityPicker({ value, onChange, disabled = false }: EntityPickerProps) {
  const { t } = useLanguage()
  const tx = t as unknown as Record<string, string>

  return (
    <div
      role="radiogroup"
      aria-label={tx.importEntityPickAriaLabel ?? 'What are you importing'}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        const Icon = opt.Icon
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
                'h-full p-4 min-h-[88px] flex items-center gap-3 border-2 ' +
                (selected
                  ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]'
                  : 'border-transparent')
              }
            >
              <Icon
                className="w-5 h-5 shrink-0"
                style={{ color: 'var(--color-primary-600)' }}
                aria-hidden="true"
              />
              <span className="flex flex-col gap-0.5">
                <span
                  className="font-semibold"
                  style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)' }}
                >
                  {tx[opt.labelKey] ?? opt.value}
                </span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                  {tx[opt.descKey] ?? ''}
                </span>
              </span>
            </Card>
          </button>
        )
      })}
    </div>
  )
}
