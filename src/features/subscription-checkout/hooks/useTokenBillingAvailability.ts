/**
 * useTokenBillingAvailability — checks if token billing is available for this account.
 */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export function useTokenBillingAvailability(): boolean {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let active = true
    async function check() {
      try {
        const res = await api<{ enabled: boolean }>('/subscription/token-checkout/availability')
        if (active && res?.enabled) {
          setEnabled(true)
        }
      } catch {
        // Fail closed on error
      }
    }
    void check()
    return () => {
      active = false
    }
  }, [])

  return enabled
}
