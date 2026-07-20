/** Invoice Report — range picker on the emerald hero field (mockup #15).
 *
 * Shows the preset name as a plain text Select and the resolved dates under
 * it ("1 Jun – 8 Jun 2026"), so the range is always legible without opening
 * the picker.
 */

import { Select, SelectItem } from '@/components/ui/Select'
import { useLanguage } from '@/hooks/useLanguage'
import { DATE_RANGE_PRESET_KEYS } from '../report.constants'
import { formatRangeLabel } from '../invoice-report.utils'
import type { DateRangePreset } from '../report.types'

interface InvoiceReportPeriodProps {
  activePreset: DateRangePreset
  from?: string
  to?: string
  onPresetChange: (value: string) => void
}

export function InvoiceReportPeriod({
  activePreset,
  from,
  to,
  onPresetChange,
}: InvoiceReportPeriodProps) {
  const { t } = useLanguage()

  return (
    <div className="invoice-report-period">
      <Select
        value={activePreset}
        onValueChange={onPresetChange}
        ariaLabel={t.dateRangeFilter}
        className="invoice-report-period__select"
      >
        {(Object.keys(DATE_RANGE_PRESET_KEYS) as DateRangePreset[]).map((preset) => (
          <SelectItem key={preset} value={preset}>
            {t[DATE_RANGE_PRESET_KEYS[preset]]}
          </SelectItem>
        ))}
      </Select>

      <span className="invoice-report-period__range">
        {formatRangeLabel(from, to)}
      </span>
    </div>
  )
}
