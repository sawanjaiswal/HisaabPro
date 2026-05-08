/** ProductionRunWizardStep3 — Review Components (stock preview) */

import { useState, useEffect } from 'react'
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import { getBom } from '../../bom/bom.service'
import { buildAvailabilities, hasInsufficientStock, hasLowStock } from '../production-run.utils'
import type { WizardFormState, ComponentAvailability } from '../production-run.types'

interface Step3Props {
  wizard: WizardFormState
  onNext: () => void
  onBack: () => void
}

function StockIcon({ status }: { status: ComponentAvailability['status'] }) {
  if (status === 'ok') return <CheckCircle size={16} className="pr-avail-icon pr-avail-icon--ok" aria-label="Sufficient stock" />
  if (status === 'low') return <AlertTriangle size={16} className="pr-avail-icon pr-avail-icon--low" aria-label="Low stock" />
  return <XCircle size={16} className="pr-avail-icon pr-avail-icon--insufficient" aria-label="Insufficient stock" />
}

export function ProductionRunWizardStep3({ wizard, onNext, onBack }: Step3Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [avail, setAvail] = useState<ComponentAvailability[]>([])

  const qty = parseFloat(wizard.quantityProduced)

  useEffect(() => {
    if (!wizard.bomId) return
    setLoading(true)
    getBom(wizard.bomId)
      .then((b) => {
        setAvail(buildAvailabilities(b, qty))
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [wizard.bomId, qty])

  const blocked = hasInsufficientStock(avail)
  const warned = hasLowStock(avail) && !blocked

  return (
    <div className="pr-wizard-step">
      <h2 className="pr-wizard-step__title">Review Components</h2>
      <p className="pr-wizard-step__desc">
        Producing <strong>{qty}</strong> × {wizard.finishedProductName}
      </p>

      {/* Banners */}
      {blocked && (
        <div className="pr-wizard-banner pr-wizard-banner--error" role="alert">
          <XCircle size={18} aria-hidden="true" />
          <span>Cannot proceed — insufficient stock for one or more components.</span>
        </div>
      )}
      {warned && (
        <div className="pr-wizard-banner pr-wizard-banner--warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Some materials are low on stock. Run will proceed with warnings recorded.</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bom-skeleton" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bom-skeleton__card" style={{ height: 48 }} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="pr-wizard-error" role="alert">Failed to load component data. Go back and retry.</p>
      )}

      {/* Component list */}
      {!loading && !error && avail.length > 0 && (
        <ul className="pr-avail-list" role="list">
          {avail.map((a) => (
            <li key={a.componentProductId} className={`pr-avail-item pr-avail-item--${a.status}`}>
              <StockIcon status={a.status} />
              <div className="pr-avail-item__info">
                <span className="pr-avail-item__name">{a.componentProductName}</span>
                <span className="pr-avail-item__qty">
                  Need {a.required}{a.unitName ? ` ${a.unitName}` : ''} · Stock {a.currentStock}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Summary info */}
      {!loading && (
        <div className="pr-wizard-cost">
          <span className="pr-wizard-cost__label">
            Based on {qty} units of {wizard.finishedProductName}
          </span>
          <span className="pr-wizard-cost__value">
            {avail.length} component{avail.length !== 1 ? 's' : ''} required
          </span>
        </div>
      )}

      <div className="pr-wizard-step__actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={blocked || loading}
          onClick={onNext}
          aria-label="Confirm production run"
          aria-disabled={blocked}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
