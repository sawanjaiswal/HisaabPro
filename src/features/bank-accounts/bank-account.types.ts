/** Bank Accounts — Type definitions
 *
 * Written first — all other layers import from here.
 * Matches API response shape from /api/bank-accounts.
 */

export type BankAccountType = 'SAVINGS' | 'CURRENT' | 'OVERDRAFT' | 'CASH'

export interface BankAccount {
  id: string
  businessId: string
  bankName: string
  accountNumber: string        // full account number
  accountHolderName: string
  ifscCode: string | null
  accountType: BankAccountType
  openingBalance: number       // paise
  currentBalance: number       // paise
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BankAccountListResponse {
  items: BankAccount[]
  total: number
}

export interface CreateBankAccountInput {
  bankName: string
  accountNumber: string
  accountHolderName: string
  ifscCode?: string
  accountType: BankAccountType
  openingBalance?: number      // paise
  isDefault?: boolean
}

export interface UpdateBankAccountInput {
  bankName?: string
  accountHolderName?: string
  ifscCode?: string
  accountType?: BankAccountType
  isDefault?: boolean
}
