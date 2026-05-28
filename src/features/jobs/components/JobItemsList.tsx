/** JobItemsList — read-only items table on the detail page */

import { formatPaise, hourlyLineLabel } from '../jobs.utils'
import type { JobItem } from '../jobs.types'

interface JobItemsListProps {
  items: JobItem[]
}

export function JobItemsList({ items }: JobItemsListProps) {
  if (items.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)' }}>
        No items on this job.
      </p>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}
        aria-label="Job items"
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Description</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Qty</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Rate</th>
            <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Total</th>
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
