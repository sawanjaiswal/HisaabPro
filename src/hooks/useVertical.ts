/** useVertical / useTerm — read the active business's vertical profile.
 *
 * Backed by the existing AuthContext. The active business is the one whose
 * id matches user.businessId; its businessType drives the VerticalProfile
 * lookup. Falls back to "general" when no business is selected (e.g. the
 * brief moment between login and onboarding).
 */

import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import {
  getVerticalProfile,
  type VerticalProfile,
  type NavKey,
} from '@/config/verticals.config'

export function useVertical(): VerticalProfile {
  const { user, businesses } = useAuth()
  return useMemo(() => {
    const active = businesses.find((b) => b.id === user?.businessId)
    return getVerticalProfile(active?.businessType)
  }, [user?.businessId, businesses])
}

/** Convenience: is this nav key visible in the current vertical? */
export function useNavVisible(): (key: NavKey) => boolean {
  const vertical = useVertical()
  return (key: NavKey) => !vertical.hiddenNavKeys.has(key)
}

/** Vertical-aware terminology. */
export function useTerm() {
  const { t } = useLanguage()
  const vertical = useVertical()
  return {
    invoice: t[vertical.invoiceTermKey],
    item: t[vertical.itemTermKey],
  }
}
