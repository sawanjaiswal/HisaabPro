/** GSTIN Verification Hook — auto-verify on valid 15-char input */

import { useState, useEffect, useRef, useCallback } from 'react'
import { validateGstin } from '@/features/tax/gstin.utils'
import { verifyGstin } from '@/features/tax/tax.service'
import { GST_STATE_CODE_MAP, GSTIN_VERIFY_DEBOUNCE_MS } from './party.constants'
import type { GstinVerifyResult } from '@/features/tax/tax.types'

export type GstinVerifyStatus = 'idle' | 'validating' | 'verified' | 'failed'

export interface GstinVerifyState {
  status: GstinVerifyStatus
  result: GstinVerifyResult | null
  stateName: string | null
}

export interface UseGstinVerifyReturn extends GstinVerifyState {
  /** Call when GSTIN field value changes */
  onGstinChange: (gstin: string) => void
  /** Reset verification state */
  reset: () => void
}

const INITIAL_STATE: GstinVerifyState = {
  status: 'idle',
  result: null,
  stateName: null,
}

export function useGstinVerify(
  initialVerified?: boolean,
  initialLegalName?: string,
  initialStatus?: string,
): UseGstinVerifyReturn {
  const [state, setState] = useState<GstinVerifyState>(() => {
    if (initialVerified && initialLegalName) {
      return {
        status: 'verified',
        result: { valid: true, stateCode: null, legalName: initialLegalName, status: initialStatus },
        stateName: null,
      }
    }
    return INITIAL_STATE
  })

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGstinRef = useRef('')

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onGstinChange = useCallback((gstin: string) => {
    // Cancel any pending verification
    abortRef.current?.abort()
    if (timerRef.current) clearTimeout(timerRef.current)

    lastGstinRef.current = gstin

    // Reset if not 15 chars
    if (gstin.length !== 15) {
      setState(INITIAL_STATE)
      return
    }

    // Client-side format validation first
    const localResult = validateGstin(gstin)
    if (!localResult.valid) {
      setState({ status: 'failed', result: { valid: false, stateCode: null, error: localResult.error }, stateName: null })
      return
    }

    // Debounce the API call
    setState(prev => ({ ...prev, status: 'validating' }))

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const result = await verifyGstin(gstin)

        // Ignore if GSTIN changed while we were verifying
        if (lastGstinRef.current !== gstin) return

        const stateCode = result.stateCode ?? gstin.substring(0, 2)
        const stateName = GST_STATE_CODE_MAP[stateCode] ?? null

        setState({
          status: result.valid ? 'verified' : 'failed',
          result,
          stateName,
        })
      } catch {
        if (lastGstinRef.current !== gstin) return
        setState({
          status: 'failed',
          result: { valid: false, stateCode: null, error: 'Verification failed. Try again later.' },
          stateName: null,
        })
      }
    }, GSTIN_VERIFY_DEBOUNCE_MS)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    if (timerRef.current) clearTimeout(timerRef.current)
    setState(INITIAL_STATE)
  }, [])

  return { ...state, onGstinChange, reset }
}
