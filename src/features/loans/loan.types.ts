/** Loans — Type definitions */

export type LoanType = 'TAKEN' | 'GIVEN'
export type LoanStatus = 'ACTIVE' | 'CLOSED' | 'OVERDUE'
export type LoanTransactionType = 'DISBURSEMENT' | 'REPAYMENT' | 'INTEREST' | 'PENALTY'

export interface Loan {
  id: string
  businessId: string
  loanType: LoanType
  partyId: string | null
  partyName: string | null
  principalAmount: number      // paise
  outstandingAmount: number    // paise
  interestRate: number         // annual %, e.g. 12.5
  emiAmount: number | null     // paise
  startDate: string
  endDate: string | null
  nextPaymentDate: string | null
  status: LoanStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface LoanListResponse {
  items: Loan[]
  total: number
}

export interface LoanTransaction {
  id: string
  loanId: string
  type: LoanTransactionType
  amount: number               // paise
  date: string
  notes: string | null
  balanceAfter: number         // paise
  createdAt: string
}

export interface LoanStatement {
  loan: Loan
  transactions: LoanTransaction[]
  totalPaid: number            // paise
  totalInterest: number        // paise
}

export interface CreateLoanInput {
  loanType: LoanType
  principalAmount: number      // paise
  interestRate: number
  startDate: string
  endDate?: string
  emiAmount?: number           // paise
  partyId?: string
  notes?: string
}

export interface CreateLoanTransactionInput {
  type: LoanTransactionType
  amount: number               // paise
  date: string
  notes?: string
}
