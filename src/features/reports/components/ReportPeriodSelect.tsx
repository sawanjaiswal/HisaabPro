/** Reports — range picker on the emerald hero field (mockups #15, #16, #69, #66).
 *
 * Shows the preset name as a plain text Select and the resolved dates under
 * it ("1 Jun – 8 Jun 2026"), so the range is always legible without opening
 * the picker.
 */

import { DateField } from '@/components/ui/DateField'
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
  /** Supply to make the "Custom range" preset usable — without it the option
   *  is hidden rather than left as a dead choice that changes nothing. */
  onRangeChange?: (range: { from: string; to: string }) => void
}

export function ReportPeriodSelect({
  activePreset,
  from,
  to,
  onPresetChange,
  onRangeChange,
}: ReportPeriodSelectProps) {
  const { t } = useLanguage()

  const presets = (Object.keys(DATE_RANGE_PRESET_KEYS) as DateRangePreset[]).filter(
    (preset) => preset !== 'custom' || onRangeChange,
  )

  return (
    <div className="report-period">
      <Select
        value={activePreset}
        onValueChange={onPresetChange}
        ariaLabel={t.dateRangeFilter}
        className="report-period__select"
      >
        {presets.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {t[DATE_RANGE_PRESET_KEYS[preset]]}
          </SelectItem>
        ))}
      </Select>

      <span className="report-period__range">{formatRangeLabel(from, to)}</span>

      {activePreset === 'custom' && onRangeChange && from && to && (
        <div className="report-period__custom">
          <DateField
            type="date"
            value={from}
            max={to}
            aria-label={t.fromDate}
            onChange={(e) => onRangeChange({ from: e.target.value, to })}
          />
          <DateField
            type="date"
            value={to}
            min={from}
            aria-label={t.toDate}
            onChange={(e) => onRangeChange({ from, to: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
