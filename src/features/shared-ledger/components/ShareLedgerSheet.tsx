/** Share Ledger Sheet — Create/manage share links for a party ledger */

import { useState } from 'react'
import { Copy, Trash2, Link, Clock, Eye } from 'lucide-react'
import { EXPIRY_OPTIONS } from '../shared-ledger.constants'
import { formatExpiry, isShareExpired, buildShareUrl } from '../shared-ledger.utils'
import type { LedgerShare, CreateLedgerShareData } from '../shared-ledger.types'
import { useLanguage } from '@/hooks/useLanguage'

interface ShareLedgerSheetProps {
  partyName: string
  shares: LedgerShare[]
  isCreating: boolean
  onCreate: (data: CreateLedgerShareData) => Promise<LedgerShare | null>
  onRevoke: (shareId: string) => void
  onCopy: (share: LedgerShare) => void
  onClose: () => void
}

export function ShareLedgerSheet({
  partyName: _partyName, shares, isCreating, onCreate, onRevoke, onCopy, onClose,
}: ShareLedgerSheetProps) {
  const { t } = useLanguage()
  const [expiryDays, setExpiryDays] = useState<number | null>(30)

  const handleCreate = async () => {
    await onCreate({ expiryDays })
  }

  return (
    <div className="share-ledger-sheet">
      <div className="share-ledger-header">
        <h3 className="share-ledger-title">{t.shareLedger}</h3>
        <p className="share-ledger-subtitle">
          {t.shareTxnHistory}
        </p>
      </div>

      {/* Create new share */}
      <div className="share-ledger-create">
        <div className="share-ledger-expiry">
          <label className="share-ledger-label">{t.linkExpiresIn}:</label>
          <select
            className="share-ledger-select"
            value={expiryDays ?? 'never'}
            onChange={(e) => setExpiryDays(e.target.value === 'never' ? null : Number(e.target.value))}
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? 'never'}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-md share-ledger-create-btn"
          onClick={handleCreate}
          disabled={isCreating}
        >
          <Link size={18} aria-hidden="true" />
          {isCreating ? t.loading : t.generateShareLink}
        </button>
      </div>

      {/* Existing shares */}
      {shares.length > 0 && (
        <div className="share-ledger-list">
          <h4 className="share-ledger-list-title">{t.activeLinks}</h4>
          {shares.map((share) => {
            const expired = isShareExpired(share)
            return (
              <div key={share.id} className={`share-ledger-item${expired ? ' share-ledger-item-expired' : ''}`}>
                <div className="share-ledger-item-info">
                  <span className="share-ledger-item-url">
                    {buildShareUrl(share.shareToken).replace(/^https?:\/\//, '').slice(0, 30)}...
                  </span>
                  <div className="share-ledger-item-meta">
                    <span><Clock size={12} aria-hidden="true" /> {formatExpiry(share.expiresAt)}</span>
                    <span><Eye size={12} aria-hidden="true" /> {share.viewCount} {t.views}</span>
                  </div>
                </div>
                <div className="share-ledger-item-actions">
                  <button
                    type="button"
                    className="share-ledger-icon-btn"
                    onClick={() => onCopy(share)}
                    aria-label={t.share}
                    disabled={expired}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="share-ledger-icon-btn share-ledger-icon-btn-danger"
                    onClick={() => onRevoke(share.id)}
                    aria-label={t.revokeLink}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button type="button" className="btn btn-ghost btn-md share-ledger-close" onClick={onClose}>
        Close
      </button>
    </div>
  )
}
