/** Voice Entry — keyword maps & number words (Hindi + English, Indian usage) */

import type { VoicePaymentMode } from './voice.types'

/** Words that signal money LEAVING (expense). */
export const EXPENSE_KEYWORDS = [
  'expense', 'spent', 'spend', 'paid', 'pay', 'bill', 'purchase', 'bought', 'buy',
  'kharch', 'kharcha', 'kharche', 'diya', 'dena', 'di', 'kharidi', 'kharida',
  'खर्च', 'दिया', 'खरीदा',
]

/** Words that signal money COMING IN (income). */
export const INCOME_KEYWORDS = [
  'income', 'received', 'receive', 'earn', 'earned', 'profit',
  'aaya', 'aayi', 'aamdani', 'mila', 'mili', 'kamaya', 'kamai',
  'interest', 'rent', 'rental', 'commission', 'dividend', 'refund',
  'आय', 'मिला', 'आया', 'किराया',
]

/** Payment-mode keyword → mode. First match wins (order matters). */
export const PAYMENT_MODE_KEYWORDS: Array<[string[], VoicePaymentMode]> = [
  [['upi', 'gpay', 'google pay', 'phonepe', 'phone pe', 'paytm', 'bhim'], 'UPI'],
  [['cheque', 'check', 'चेक'], 'CHEQUE'],
  [['bank', 'transfer', 'neft', 'imps', 'rtgs', 'account'], 'BANK_TRANSFER'],
  [['card', 'credit', 'debit', 'swipe'], 'CARD'],
  [['cash', 'nakad', 'nagad', 'rokad', 'नकद', 'रोकड़'], 'CASH'],
]

/** Income category guesses — keyword → canonical label. */
export const INCOME_CATEGORY_KEYWORDS: Array<[string[], string]> = [
  [['interest', 'byaj', 'ब्याज'], 'Interest'],
  [['rent', 'rental', 'kiraya', 'किराया'], 'Rental'],
  [['commission', 'dalali'], 'Commission'],
  [['refund', 'wapsi'], 'Refund'],
  [['dividend'], 'Dividend'],
]

/** Currency words/symbols stripped before amount parsing. */
export const CURRENCY_TOKENS = ['₹', 'rs.', 'rs', 'inr', 'rupees', 'rupee', 'rupaye', 'rupaya', 'rupaiya', 'रुपये', 'रुपया']

/** Scale words → multiplier. */
export const SCALE_WORDS: Record<string, number> = {
  hundred: 100, sau: 100, सौ: 100,
  thousand: 1000, hazaar: 1000, hazar: 1000, hajar: 1000, k: 1000, हज़ार: 1000, हजार: 1000,
  lakh: 100000, lac: 100000, lakhs: 100000, लाख: 100000,
  crore: 10000000, cr: 10000000, करोड़: 10000000,
}

/** Whole-number words (units, tens). */
export const NUMBER_WORDS: Record<string, number> = {
  zero: 0, ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, chah: 6, six: 6, saat: 7, seven: 7,
  aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10,
  bees: 20, twenty: 20, pachas: 50, pachaas: 50, fifty: 50,
}

/** Fractional-prefix words common in Hindi (modify the following scale). */
export const FRACTION_WORDS: Record<string, number> = {
  adha: 0.5, aadha: 0.5, sava: 1.25, sawa: 1.25, dedh: 1.5, dhai: 2.5, dhaai: 2.5, adhai: 2.5,
}

/** Relative-date words → day offset from today (negative = past). */
export const DATE_OFFSET_WORDS: Array<[string[], number]> = [
  [['yesterday', 'kal', 'कल'], -1],
  [['today', 'aaj', 'आज'], 0],
]
