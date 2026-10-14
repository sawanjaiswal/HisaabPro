/** JobItemsList — read-only items table on the detail page */

import { Text } from '@/components/ui/Text'
import { formatPaise, hourlyLineLabel } from '../jobs.utils'
import type { JobItem } from '../jobs.types'
import { useLanguage } from '@/hooks/useLanguage'

interface JobItemsListProps {
  items: JobItem[]
}

export function JobItemsList({ items }: JobItemsListProps) {
  const { t } = useLanguage()
  if (items.length === 0) {
    return (
      <Text className="text-sm text-[var(--text-secondary)]">
        {t.jobNoItems}
      </Text>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        aria-label={t.jobItemsTableAria}
      >
        <thead>
          <tr className="border-b-2 border-[var(--color-border)]">
            <th className="text-left p-2 text-[var(--color-text-secondary)] font-semibold">{t.jobColDescription}</th>
            <th className="text-right p-2 text-[var(--color-text-secondary)] font-semibold">{t.jobColQty}</th>
            <th className="text-right p-2 text-[var(--color-text-secondary)] font-semibold">{t.jobColRate}</th>
            <th className="text-right p-2 text-[var(--color-text-secondary)] font-semibold">{t.jobColTotal}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[var(--color-border)]">
              <td className="p-2 text-[var(--color-text)]">
                {item.description}
                {hourlyLineLabel(item) && (
                  <span className="block text-xs text-[var(--color-text-secondary)]">
                    {hourlyLineLabel(item)}
                  </span>
                )}
              </td>
              <td className="p-2 text-right text-[var(--color-text-secondary)]">{item.quantity}</td>
              <td className="p-2 text-right text-[var(--color-text-secondary)]">₹{formatPaise(item.ratePaise)}</td>
              <td className="p-2 text-right font-semibold text-[var(--color-text)]">₹{formatPaise(item.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
