/**
 * Party detail — Tab list builder.
 *
 * Owns the visibility logic for conditional tabs (currently: Loyalty, which
 * is gated by the program being enabled). Keeps PartyDetailPage.tsx under
 * the 250-line file ratchet.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { useLoyaltyProgram } from '@/features/loyalty/hooks/useLoyaltyProgram'

export type PartyDetailTab =
  | 'overview'
  | 'transactions'
  | 'addresses'
  | 'ledger'
  | 'crm'
  | 'loyalty'

export interface PartyDetailTabSpec {
  id: PartyDetailTab
  label: string
}

export function usePartyDetailTabs(): { tabs: PartyDetailTabSpec[]; isLoyaltyOn: boolean } {
  const { t } = useLanguage()
  const { program } = useLoyaltyProgram()
  const isLoyaltyOn = Boolean(program?.enabled)

  const tabs: PartyDetailTabSpec[] = [
    { id: 'overview', label: t.overview },
    { id: 'transactions', label: t.transactions },
    { id: 'addresses', label: t.addresses },
    { id: 'ledger', label: t.ledgerTab },
    { id: 'crm', label: t.crmDetailTabCrm },
    ...(isLoyaltyOn ? [{ id: 'loyalty' as const, label: t.loyaltyTabTitle }] : []),
  ]

  return { tabs, isLoyaltyOn }
}
