/**
 * Phase 7 Slice 7.1A FE.4 — Single duplicate-row card.
 *
 * Two-column layout (stacks on mobile): "Incoming" (parsed row from
 * the file) vs "Existing" (matched party in the same business). Match
 * type chip + score (for NEAR) sit at the top-right. Bottom row is a
 * radio group {Skip / Overwrite / Create new} bound to the parent
 * resolution state.
 *
 * No safe-area / fixed-bottom CSS — the card lives in normal flow
 * inside <PageContainer>.
 */

import { Card } from '@/components/ui/Card'
import { formatPaise } from '@/lib/format'
import {
  readNormalizedBalancePaise,
  readNormalizedName,
  readNormalizedPhone,
} from '../utils/preview-filters'
import { DEDUP_DECISIONS } from '../constants/dedup.constants'
import type { DedupDecision } from '../types/dedup.types'
import type { DedupRowWithMeta } from '../hooks/useDedupState'
import { Input } from '@/components/ui/Input'

interface DedupRowCardProps {
  item: DedupRowWithMeta
  decision: DedupDecision
  onChange: (decision: DedupDecision) => void
  t: Record<string, string>
}

export function DedupRowCard({ item, decision, onChange, t }: DedupRowCardProps) {
  const { row, match } = item
  const incomingName = readNormalizedName(row) || (t.importPreviewMissingName ?? '—')
  const incomingPhone = readNormalizedPhone(row) || (t.importPreviewMissingPhone ?? '—')
  const incomingBalance = formatPaise(readNormalizedBalancePaise(row))
  const existingName =
    match.matchedPartyName ?? (t.importDedupExistingFallback ?? 'Existing party')

  const chipBg =
    match.matchType === 'EXACT'
      ? 'var(--color-danger-soft, var(--color-gray-50))'
      : 'var(--color-warning-soft, var(--color-gray-50))'
  const chipFg =
    match.matchType === 'EXACT'
      ? 'var(--color-danger, var(--color-text-primary))'
      : 'var(--color-warning, var(--color-text-primary))'

  return (
    <Card variant="default" className="p-4 space-y-3">
      <header className="flex items-start justify-between gap-2">
        <span
          className="font-medium tabular-nums"
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}
        >
          {t.importPreviewColRow ?? 'Row'} {row.sourceIndex + 1}
        </span>
        <span
          className="inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 font-medium"
          style={{
            fontSize: 'var(--fs-xs)',
            backgroundColor: chipBg,
            color: chipFg,
          }}
        >
          {match.matchType === 'EXACT'
            ? (t.importDedupMatchExact ?? 'Exact match')
            : (t.importDedupMatchNear ?? 'Near match')}
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DedupSide
          title={t.importDedupIncoming ?? 'Incoming row'}
          name={incomingName}
          phone={incomingPhone}
          balance={incomingBalance}
          t={t}
        />
        <DedupSide
          title={t.importDedupExisting ?? 'Existing party'}
          name={existingName}
          phone={t.importDedupExistingPhoneUnknown ?? '—'}
          balance={null}
          t={t}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5 pt-1">
        <legend
          className="sr-only"
        >
          {t.importDedupChooseAriaLabel ?? 'Choose action for this row'}
        </legend>
        {DEDUP_DECISIONS.map((d) => (
          <label
            key={d}
            className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
          >
            <Input
              type="radio"
              name={`dedup-${row.id}`}
              value={d}
              checked={decision === d}
              onChange={() => onChange(d)}
              className="h-4 w-4"
            />
            <span>{t[`importDedupDecision_${d}`] ?? decisionFallback(d)}</span>
          </label>
        ))}
      </fieldset>
    </Card>
  )
}

function decisionFallback(d: DedupDecision): string {
  switch (d) {
    case 'SKIP':
      return 'Skip — keep existing party'
    case 'OVERWRITE':
      return 'Overwrite existing party with this row'
    case 'CREATE_NEW':
      return 'Create as a new party anyway'
  }
}

interface DedupSideProps {
  title: string
  name: string
  phone: string
  balance: string | null
  t: Record<string, string>
}

function DedupSide({ title, name, phone, balance, t }: DedupSideProps) {
  return (
    <div className="space-y-1">
      <p
        className="font-medium"
        style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
      >
        {title}
      </p>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}>
        {name}
      </p>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
        {phone}
      </p>
      {balance !== null && (
        <p
          className="tabular-nums"
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}
        >
          {t.importPreviewColBalance ?? 'Balance'}: {balance}
        </p>
      )}
    </div>
  )
}
