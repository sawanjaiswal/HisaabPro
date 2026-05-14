/**
 * useUpiPayLink — memoizes the UPI deep-link for an invoice
 *
 * Returns { upiLink, isValid } — isValid is true when VPA passes regex
 * and a link can be built. Memoized on (vpa, amountPaise, payeeName, ref).
 */
import { useMemo } from 'react'
import { buildUpiLink, isValidVpa } from '@/lib/upi'

export interface UseUpiPayLinkArgs {
  vpa: string | null | undefined
  payeeName: string
  amountPaise: number
  transactionRef: string
  transactionNote?: string
}

export interface UseUpiPayLinkReturn {
  upiLink: string | null
  isValid: boolean
}

export function useUpiPayLink({
  vpa,
  payeeName,
  amountPaise,
  transactionRef,
  transactionNote,
}: UseUpiPayLinkArgs): UseUpiPayLinkReturn {
  return useMemo(() => {
    if (!vpa) return { upiLink: null, isValid: false }

    const isValid = isValidVpa(vpa)
    if (!isValid) return { upiLink: null, isValid: false }

    const upiLink = buildUpiLink({
      payeeVpa: vpa,
      payeeName,
      amountPaise,
      transactionRef,
      transactionNote,
    })

    return { upiLink, isValid: upiLink !== null }
  }, [vpa, payeeName, amountPaise, transactionRef, transactionNote])
}
