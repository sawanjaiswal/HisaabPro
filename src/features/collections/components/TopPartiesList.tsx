/**
 * TopPartiesList — top 5 parties by outstanding amount.
 * Card layout: avatar circle (initials), name, overdue amount + days pill.
 */

import { ChevronRight } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import type { TopOutstandingParty } from '../collections.types'
import '../styles/aging.css'

interface Props {
  parties: TopOutstandingParty[]
  sectionTitle: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    const last = digits.slice(-4)
    return `+91XXXXX${last}`
  }
  return phone
}

export function TopPartiesList({ parties, sectionTitle }: Props) {
  if (parties.length === 0) return null

  return (
    <section className="aging-section" aria-labelledby="top-parties-heading">
      <p id="top-parties-heading" className="aging-section__title">{sectionTitle}</p>
      <ul className="top-parties" aria-label={sectionTitle}>
        {parties.map((party) => (
          <li key={party.partyId} className="top-party-row">
            <div className="top-party-row__avatar" aria-hidden="true">
              {getInitials(party.name)}
            </div>
            <div className="top-party-row__info">
              <p className="top-party-row__name">{party.name}</p>
              {party.phone && (
                <p className="top-party-row__sub">{maskPhone(party.phone)}</p>
              )}
            </div>
            <div className="top-party-row__right">
              <span
                className="top-party-row__amount"
                aria-label={`Outstanding: ${formatPaise(party.totalOutstanding)}`}
              >
                {formatPaise(party.totalOutstanding)}
              </span>
              {party.overdueInvoiceCount > 0 && (
                <span className="top-party-row__days-pill">
                  {party.overdueInvoiceCount} overdue
                </span>
              )}
            </div>
            <ChevronRight size={14} className="top-party-row__chevron" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </section>
  )
}
