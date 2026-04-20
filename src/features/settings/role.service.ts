/** Roles & Permissions — API service layer
 *
 * All service functions accept an optional AbortSignal for cleanup in useEffect.
 * The `api()` helper already prepends API_URL, so paths begin with /.
 */

import { api } from '@/lib/api'
import type {
  RolesListResponse,
  RoleDetailResponse,
  RoleFormData,
  RoleDeleteResponse,
  PermissionMatrix,
  Role,
} from './settings.types'

// ─── Local response shapes ────────────────────────────────────────────────────

export interface PermissionMatrixResponse {
  success: boolean
  data: PermissionMatrix
}

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * Fetch all roles for a business.
 * System roles (OWNER, ADMIN, STAFF) are always present; custom roles appear after.
 * Response includes staffCount per role so the UI can show "N staff".
 */
export async function getRoles(
  businessId: string,
  signal?: AbortSignal
): Promise<RolesListResponse> {
  // Backend returns roles array directly in data; api() unwraps success envelope.
  // Re-wrap to the shape consumers expect (`.data.roles`).
  const unwrapped = await api<Role[] | { roles: Role[] }>(
    `/businesses/${businessId}/roles`,
    { signal }
  )
  const roles = Array.isArray(unwrapped) ? unwrapped : unwrapped.roles ?? []
  return { success: true, data: { roles } }
}

/**
 * Fetch detail for a single role, including the full permissions array.
 */
export async function getRole(
  businessId: string,
  roleId: string,
  signal?: AbortSignal
): Promise<RoleDetailResponse> {
  return api<RoleDetailResponse>(
    `/businesses/${businessId}/roles/${roleId}`,
    { signal }
  )
}

/**
 * Create a new custom role for the business.
 * System roles (isSystem: true) cannot be created via this endpoint.
 * Returns the created role as RoleDetailResponse (201 Created).
 */
export async function createRole(
  businessId: string,
  data: RoleFormData,
  signal?: AbortSignal
): Promise<RoleDetailResponse> {
  return api<RoleDetailResponse>(
    `/businesses/${businessId}/roles`,
    {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }
  )
}

/**
 * Update an existing custom role's name, description, permissions, or default status.
 * Returns 403 if attempting to modify a system role.
 * Returns the updated role as RoleDetailResponse.
 */
export async function updateRole(
  businessId: string,
  roleId: string,
  data: Partial<RoleFormData>,
  signal?: AbortSignal
): Promise<RoleDetailResponse> {
  return api<RoleDetailResponse>(
    `/businesses/${businessId}/roles/${roleId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }
  )
}

/**
 * Delete a custom role. All staff currently on this role must be reassigned.
 * Pass reassignTo (another roleId) — server moves staff atomically.
 * Returns the number of staff reassigned.
 * Returns 400 if reassignTo is the same as the deleted role.
 * Returns 403 if attempting to delete a system role.
 */
export async function deleteRole(
  businessId: string,
  roleId: string,
  reassignTo: string,
  signal?: AbortSignal
): Promise<RoleDeleteResponse> {
  return api<RoleDeleteResponse>(
    `/businesses/${businessId}/roles/${roleId}?reassignTo=${encodeURIComponent(reassignTo)}`,
    {
      method: 'DELETE',
      signal,
    }
  )
}

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Fetch the global permission matrix — all modules and their available actions.
 * This is a static reference endpoint (not business-specific).
 * Used to populate the role builder UI.
 */
export async function getPermissionMatrix(
  signal?: AbortSignal
): Promise<PermissionMatrixResponse> {
  return api<PermissionMatrixResponse>('/permissions/matrix', { signal })
}
