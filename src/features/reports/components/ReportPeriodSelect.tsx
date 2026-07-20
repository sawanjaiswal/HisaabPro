/** Reports — range picker on the emerald hero field (mockups #15, #16, #69, #66).
 *
 * Shows the preset name as a plain text Select and the resolved dates under
 * it ("1 Jun – 8 Jun 2026"), so the range is always legible without opening
 * the picker.
 */

import { Select, SelectItem } from '@/components/ui/Select'
import { useLanguage } from '@/hooks/useLanguage'
import { DATE_RANGE_PRESET_KEYS } from '../report.constants'
import { formatRangeLabel } from '../report-analytics.utils'
import type { DateRangePreset } from '../report.types'

interface ReportPeriodSelectProps {
  activePreset: DateRangePreset
  from?: string
  to?: string
  onPresetChange: (value: string) => void
}

export function ReportPeriodSelect({
  activePreset,
  from,
  to,
  onPresetChange,
}: ReportPeriodSelectProps) {
  const { t } = useLanguage()

  return (
    <div className="report-period">
      <Select
        value={activePreset}
        onValueChange={onPresetChange}
        ariaLabel={t.dateRangeFilter}
        className="report-period__select"
      >
        {(Object.keys(DATE_RANGE_PRESET_KEYS) as DateRangePreset[]).map((preset) => (
          <SelectItem key={preset} value={preset}>
            {t[DATE_RANGE_PRESET_KEYS[preset]]}
          </SelectItem>
        ))}
      </Select>

      <span className="report-period__range">{formatRangeLabel(from, to)}</span>
    </div>
  )
}
