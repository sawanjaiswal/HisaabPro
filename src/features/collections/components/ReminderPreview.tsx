/**
 * ReminderPreview — collapsible preview of the rendered message for the
 * first selected party.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { PartyInBucket } from '../collections.types'
import { renderTemplate, type TemplateKey } from '../reminder-templates'
import { formatPaise } from '@/lib/format'

interface ReminderPreviewProps {
  party: PartyInBucket
  templateKey: TemplateKey
  customMessage: string
  businessName: string
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? `+91XXXXX${digits.slice(-4)}` : phone
}

export function ReminderPreview({
  party,
  templateKey,
  customMessage,
  businessName,
}: ReminderPreviewProps) {
  const [expanded, setExpanded] = useState(false)

  const rendered = renderTemplate(templateKey, {
    name: party.name,
    amount: formatPaise(party.totalOutstanding),
    business_name: businessName,
    due_date: 'N/A',
    oldest_invoice_date: 'N/A',
  })

  const finalMessage = customMessage.trim()
    ? `${rendered}\n\n${customMessage}`
    : rendered

  return (
    <div className="reminder-preview">
      <button
        type="button"
        className="reminder-preview__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="reminder-preview__toggle-label">
          Preview for {party.name}
          {party.phone && (
            <span className="reminder-preview__phone"> · {maskPhone(party.phone)}</span>
          )}
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="reminder-preview__body" role="region" aria-label="Message preview">
          <pre className="reminder-preview__text">{finalMessage}</pre>
        </div>
      )}
    </div>
  )
}
