/** CampaignWizardStep3 — Audience / Segment builder */

import { useLanguage } from '@/hooks/useLanguage'
import { AudiencePicker } from './AudiencePicker'
import { useSegmentPreview } from '../hooks/useSegmentPreview'
import type { SegmentFilter } from '../marketing.types'

interface Props {
  value: SegmentFilter
  onChange: (filter: SegmentFilter) => void
}

export function CampaignWizardStep3Audience({ value, onChange }: Props) {
  const { t } = useLanguage()
  const { preview, tooLarge } = useSegmentPreview(value)

  return (
    <div className="flex flex-col gap-4">
      <AudiencePicker value={value} onChange={onChange} />

      {tooLarge && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-[var(--color-error-50)] border border-[var(--color-error-200)] text-destructive text-xs"
        >
          {t.marketingAudienceTooLarge}
        </div>
      )}

      {!tooLarge && preview != null && preview.count === 0 && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-[var(--color-warning-50)] border border-[var(--color-warning-200)] text-amber-700 text-xs"
        >
          {t.marketingAudienceNoMatch}
        </div>
      )}

      {!tooLarge && preview != null && preview.sample.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            {t.marketingSampleRecipients}
          </div>
          <div className="flex flex-col gap-1">
            {preview.sample.slice(0, 5).map((p) => (
              <div key={p.id} className="flex gap-2 items-center py-2 px-2.5 rounded-lg bg-[var(--color-gray-50)] text-xs">
                <span className="font-semibold text-[var(--text-primary)] flex-1">{p.name}</span>
                <span className="text-[var(--text-muted)]">{p.phone ?? t.marketingNoPhone}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
