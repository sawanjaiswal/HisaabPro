/**
 * #133 BOGO — frontend gate for the FREE-item toggle in LineItemEditor.
 *
 * The authoritative check lives on the server (requireBogoIfFreeItem
 * middleware). This hook just hides the toggle for roles that don't have
 * `invoicing.bogo` so the UI is honest. Owner role bypasses all permission
 * checks server-side, so we mirror that here. For custom roles, the
 * backend will 403 the request if isFreeItem is sent without permission.
 */
import { useAuth } from '@/context/AuthContext'

export function useBogoPermission(): boolean {
  const { user, businesses } = useAuth()
  if (!user?.businessId) return false
  const current = businesses.find((b) => b.id === user.businessId)
  if (!current) return false
  return current.role === 'owner'
}
