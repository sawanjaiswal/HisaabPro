/**
 * #133 BOGO — frontend gate for the FREE-item toggle in LineItemEditor.
 *
 * The authoritative check lives on the server (requireBogoIfFreeItem
 * middleware). This hook just hides the toggle for roles that don't have
 * `invoicing.bogo` so the UI is honest. Owner role bypasses all permission
 * checks server-side, so we mirror that here.
 *
 * PR3 (Epic B): widened to also allow custom roles that carry the
 * `invoicing.bogo` permission slug. The `permissions` array is populated
 * by the server in the /me response from `BusinessUser.roleRef.permissions`.
 * Owners always return early (their permissions array is intentionally empty).
 */
import { useAuth } from '@/context/AuthContext'

export function useBogoPermission(): boolean {
  const { user, businesses } = useAuth()
  if (!user?.businessId) return false
  const current = businesses.find((b) => b.id === user.businessId)
  if (!current) return false
  const hasOwnerRole = current.role === 'owner'
  const hasBogoPermission = current.permissions?.includes('invoicing.bogo') ?? false
  return hasOwnerRole || hasBogoPermission
}
