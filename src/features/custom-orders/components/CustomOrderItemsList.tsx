/** CustomOrderItemsList — read-only items table with spec rendering on the detail page */

import { Text } from '@/components/ui/Text'
import { formatPaise, formatSpecOneLiner } from '../custom-orders.utils'
import type { CustomOrderItem } from '../custom-orders.types'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrderItemsListProps {
  items: CustomOrderItem[]
}

export function CustomOrderItemsList({ items }: CustomOrderItemsListProps) {
  const { t } = useLanguage()
  if (items.length === 0) {
    return (
      <Text className="text-sm text-[var(--text-secondary)]">
        {t.coNoItems}
      </Text>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        aria-label={t.coOrderItemsAria}
      >
        <thead>
          <tr className="border-b-2 border-[var(--color-border)]">
            <th className="text-left p-2 text-[var(--color-text-secondary)] font-semibold">{t.coColDescription}</th>
            <th className="text-right p-2 text-[var(--color-text-secondary)] font-semibold">{t.qty}</th>
            <th className="text-right p-2 text-[var(--color-text-secondary)] font-semibold">{t.coColRate}</th>
            <th className="text-right p-2 text-[var(--color-text-secondary)] font-semibold">{t.coColTotal}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[var(--color-border)]">
              <td className="p-2 text-[var(--color-text)]">
                <div>{item.description}</div>
                {item.spec && (
                  <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {formatSpecOneLiner(item.spec).replace(/^\s*\(|\)\s*$/g, '')}
                  </div>
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
