/** JobItemsList — read-only items table on the detail page */

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
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)' }}>
        {t.jobNoItems}
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}
        aria-label={t.jobItemsTableAria}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.jobColDescription}</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.jobColQty}</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.jobColRate}</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.jobColTotal}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: 'var(--space-2)', color: 'var(--color-text)' }}>
                {item.description}
                {hourlyLineLabel(item) && (
                  <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                    {hourlyLineLabel(item)}
                  </span>
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
