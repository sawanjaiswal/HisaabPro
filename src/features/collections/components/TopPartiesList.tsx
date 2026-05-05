/**
 * TopPartiesList — top 5 parties by outstanding amount.
 * Vertical list, works at 320px without horizontal scroll.
 */

import { formatPaise } from '@/lib/format'
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
      <p id="top-parties-heading" className="aging-section__title">{sectionTitle}</p>
      <ul className="top-parties" aria-label={sectionTitle}>
        {parties.map((party, idx) => (
          <li key={party.partyId} className="top-party-row">
            <span className="top-party-row__rank" aria-label={`Rank ${idx + 1}`}>
              {idx + 1}
            </span>
            <div className="top-party-row__info">
              <p className="top-party-row__name">{party.name}</p>
              {party.phone && (
                <p className="top-party-row__sub">{maskPhone(party.phone)}</p>
              )}
            </div>
            <span className="top-party-row__amount" aria-label={`Outstanding: ${formatPaise(party.totalOutstanding)}`}>
              {formatPaise(party.totalOutstanding)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
