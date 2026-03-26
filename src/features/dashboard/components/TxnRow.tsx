/** Dashboard — Single transaction row in the recent activity feed */

import { IndianRupee } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatSignedAmount, isInflowType, formatDate } from '../dashboard.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'
import type { RecentActivityItem } from '../dashboard.types'

interface TxnRowProps {
  item: RecentActivityItem
  onItemClick: (item: RecentActivityItem) => void
  onAddPayment: (item: RecentActivityItem) => void
}

export function TxnRow({ item, onItemClick, onAddPayment }: TxnRowProps) {
  const { t } = useLanguage()
  const isUnpaid = item.status === 'unpaid' || item.status === 'partial'
  const isInvoice = item.type === 'sale_invoice' || item.type === 'purchase_invoice'
  const showAdd = isUnpaid && isInvoice

  return (
    <div
      className="dashboard-txn-row"
      data-type={item.type}
      role="listitem"
      tabIndex={0}
      onClick={() => onItemClick(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(item) } }}
    >
      <div className="dashboard-txn-avatar">
        <PartyAvatar name={item.partyName} size="sm" />
      </div>
      <div className="dashboard-txn-info">
        <span className="dashboard-txn-name">{item.partyName}</span>
        <div className="dashboard-txn-meta">
          <span>{item.reference}</span>
          <span className="dashboard-txn-meta-dot" aria-hidden="true" />
          <span>{formatDate(item.date)}</span>
        </div>
      </div>
      {showAdd && (
        <button
          className="dashboard-txn-add-btn"
          onClick={(e) => { e.stopPropagation(); onAddPayment(item) }}
          aria-label={`Record payment for ${item.partyName}`}
        >
          <IndianRupee size={14} aria-hidden="true" />
          <span>{t.add}</span>
        </button>
      )}
      <div className="dashboard-txn-right">
        <span className={`dashboard-txn-amount ${isInflowType(item.type) ? 'dashboard-txn-amount--in' : 'dashboard-txn-amount--out'}`}>
          {formatSignedAmount(item.amount, item.type)}
        </span>
        {item.status && (
          <span className={`dashboard-txn-status dashboard-txn-status--${item.status}`}>
            {item.status === 'paid' ? t.paid : item.status === 'partial' ? t.partial : t.unpaid}
          </span>
        )}
        {item.mode && (
          <span className="dashboard-txn-mode">{item.mode}</span>
        )}
      </div>
    </div>
  )
}
