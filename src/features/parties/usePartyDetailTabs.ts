/**
 * Party detail — Tab list builder.
 *
 * The detail page shows four tabs matching the Customer Details mockup:
 * Ledger · Invoices · Payments · Info. "Info" folds the old Overview,
 * Addresses and CRM sections into one tab.
 */

import type { LucideIcon } from 'lucide-react'
import { List, FileText, CreditCard, Info } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export type PartyDetailTab = 'ledger' | 'invoices' | 'payments' | 'info'

export interface PartyDetailTabSpec {
  id: PartyDetailTab
  label: string
  icon: LucideIcon
}

export function usePartyDetailTabs(): { tabs: PartyDetailTabSpec[] } {
  const { t } = useLanguage()

  const tabs: PartyDetailTabSpec[] = [
    { id: 'ledger', label: t.ledgerTab, icon: List },
    { id: 'invoices', label: t.invoices, icon: FileText },
    { id: 'payments', label: t.payments, icon: CreditCard },
    { id: 'info', label: t.infoTab, icon: Info },
  ]

  return { tabs }
}
