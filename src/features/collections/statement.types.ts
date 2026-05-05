/**
 * Statement feature — TypeScript interfaces mirroring server StatementDataRes.
 * All monetary amounts are in paise (integers).
 */

export interface StatementParty {
  id: string
  name: string
  phone: string | null
  email: string | null
  gstin: string | null
  billingAddress: string | null
}

export interface StatementBusiness {
  name: string
  gstin: string | null
  phone: string | null
  logoUrl: string | null
}

export interface StatementPeriod {
  from: string
  to: string
}

export interface StatementTransaction {
  date: string
  type: string
  reference: string
  description: string
  debitPaise: number
  creditPaise: number
  balancePaise: number
  agingDays?: number
}

export interface StatementData {
  party: StatementParty
  business: StatementBusiness
  period: StatementPeriod
  openingBalancePaise: number
  transactions: StatementTransaction[]
  closingBalancePaise: number
  generatedAt: string
}
