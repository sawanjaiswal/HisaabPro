/** PartyBalanceChip — inline balance + GSTIN shown the moment a customer is
 *  picked on the invoice screen.
 *
 * Selling context: the shopkeeper wants to see "does this customer already owe
 * me?" before adding items, without leaving the flow. Reads the party detail
 * via the shared getParty service + the canonical detail query key, so it
 * dedupes with (and warms) the party detail page's own cache. Silent on
 * error/loading — it's an enhancement, never a blocker.
 */

import { useQuery } from '@tanstack/react-query'
import { IndianRupee } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { getParty } from '@/features/parties/party.service'
import { useLanguage } from '@/hooks/useLanguage'
import { formatRupees } from '@/lib/format'
import './party-balance-chip.css'

interface PartyBalanceChipProps {
  /** Selected party id; empty string renders nothing. */
  partyId: string
}

export function PartyBalanceChip({ partyId }: PartyBalanceChipProps) {
  const { t } = useLanguage()
  const { data: party, isPending } = useQuery({
    queryKey: queryKeys.parties.detail(partyId),
    queryFn: ({ signal }) => getParty(partyId, signal),
    enabled: Boolean(partyId),
  })

  if (!partyId) return null

  if (isPending) {
    return <div className="party-balance-chip party-balance-chip--loading" aria-hidden="true" />
  }
  if (!party) return null

  const balance = party.outstandingBalance
  // outstandingBalance: positive = they owe us (due), negative = advance paid.
  const tone = balance > 0 ? 'due' : balance < 0 ? 'advance' : 'settled'
  const label =
    balance > 0
      ? `${formatRupees(balance)} ${t.due}`
      : balance < 0
        ? `${formatRupees(-balance)} ${t.advance}`
        : t.settled

  return (
    <div className="party-balance-row">
      <span className={`party-balance-chip party-balance-chip--${tone}`}>
        <IndianRupee size={12} aria-hidden="true" />
        <span className="tabular-nums">{label}</span>
      </span>
      {party.gstin && (
        <span className="party-balance-gstin">
          {t.gstin} · <span className="party-balance-gstin-value">{party.gstin}</span>
        </span>
      )}
    </div>
  )
}
