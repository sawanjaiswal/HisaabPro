/** CustomOrderItemsList — read-only items table with spec rendering on the detail page */

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
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)' }}>
        {t.coNoItems}
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}
        aria-label={t.coOrderItemsAria}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.coColDescription}</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.qty}</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.coColRate}</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.coColTotal}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: 'var(--space-2)', color: 'var(--color-text)' }}>
                <div>{item.description}</div>
                {item.spec && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {formatSpecOneLiner(item.spec).replace(/^\s*\(|\)\s*$/g, '')}
                  </div>
                )}
              </td>
              <td style={{ padding: 'var(--space-2)', textAlign: 'right', color: 'var(--color-text-secondary)' }}>{item.quantity}</td>
              <td style={{ padding: 'var(--space-2)', textAlign: 'right', color: 'var(--color-text-secondary)' }}>₹{formatPaise(item.ratePaise)}</td>
              <td style={{ padding: 'var(--space-2)', textAlign: 'right', fontWeight: 600, color: 'var(--color-text)' }}>₹{formatPaise(item.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
