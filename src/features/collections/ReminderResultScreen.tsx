/**
 * ReminderResultScreen — sent/excluded breakdown after bulk dispatch.
 */

import { CheckCircle, AlertTriangle } from 'lucide-react'
import type { BulkReminderResult } from './useReminderComposer'

interface ReminderResultScreenProps {
  result: BulkReminderResult
  onDone: () => void
}

const REASON_LABELS: Record<string, string> = {
  NO_PHONE: 'No phone number on file',
  INVALID_PHONE: 'Invalid phone number',
}

export function ReminderResultScreen({ result, onDone }: ReminderResultScreenProps) {
  return (
    <div className="reminder-result">
      <div className="reminder-result__hero">
        <CheckCircle size={40} className="reminder-result__icon" aria-hidden="true" />
        <h2 className="reminder-result__title">
          {result.sent} reminder{result.sent !== 1 ? 's' : ''} prepared
        </h2>
        <p className="reminder-result__subtitle">
          WhatsApp will open for each message. Delivery is not tracked.
        </p>
      </div>

      {result.excludedDetails.length > 0 && (
        <section className="reminder-result__excluded" aria-label="Skipped parties">
          <div className="reminder-result__excluded-header">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{result.excludedDetails.length} skipped</span>
          </div>
          <ul className="reminder-result__excluded-list">
            {result.excludedDetails.map((party) => (
              <li key={party.partyId} className="reminder-result__excluded-item">
                <span className="reminder-result__excluded-name">{party.name}</span>
                <span className="reminder-result__excluded-reason">
                  {REASON_LABELS[party.reason] ?? party.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="reminder-result__actions">
        <button
          type="button"
          className="reminder-result__btn reminder-result__btn--primary"
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  )
}
