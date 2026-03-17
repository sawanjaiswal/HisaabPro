// ─── Permissions ─────────────────────────────────────────────────────────────

export interface PermissionAction {
  key: string
  label: string
  description?: string
}

export interface PermissionModule {
  key: string
  label: string
  actions: PermissionAction[]
}

export interface PermissionMatrix {
  modules: PermissionModule[]
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export interface Role {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  isDefault: boolean
  priority: number
  /** Flat permission keys, e.g. ["invoicing.view", "invoicing.create"] */
  permissions: string[]
  staffCount: number
  createdAt: string
  updatedAt: string
}

export interface RoleFormData {
  name: string
  description: string
  permissions: string[]
  isDefault: boolean
}

export interface RolesListResponse {
  success: boolean
  data: { roles: Role[] }
}

export interface RoleDetailResponse {
  success: boolean
  data: { role: Role }
}

export interface RoleDeleteResponse {
  success: boolean
  data: { reassignedStaff: number }
}
