/**
 * TopPartiesList — top 5 parties by outstanding amount.
 * Card layout: avatar circle (initials), name, overdue amount + days pill.
 */

import { Text } from '@/components/ui/Text'
import { ChevronRight } from 'lucide-react'
import { formatPaise, formatInitials } from '@/lib/format'
import type { TopOutstandingParty } from '../collections.types'
import '../styles/aging.css'

interface Props {
  parties: TopOutstandingParty[]
  sectionTitle: string
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
      <Text id="top-parties-heading" className="aging-section__title">{sectionTitle}</Text>
      <ul className="top-parties" aria-label={sectionTitle}>
        {parties.map((party) => (
          <li key={party.partyId} className="top-party-row">
            <div className="top-party-row__avatar" aria-hidden="true">
              {formatInitials(party.name)}
            </div>
            <div className="top-party-row__info">
              <Text className="top-party-row__name">{party.name}</Text>
              {party.phone && (
                <Text className="top-party-row__sub">{maskPhone(party.phone)}</Text>
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
