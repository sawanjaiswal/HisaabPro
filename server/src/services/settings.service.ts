/**
 * Settings Service — barrel re-export
 *
 * All functionality split into settings/ sub-modules.
 * This file re-exports everything so existing imports keep working:
 *   import * as settingsService from '../services/settings.service.js'
 *   import { ensureSystemRoles } from './settings.service.js'
 */

export { getPermissionMatrix, ALL_PERMISSIONS, VALID_PERMISSIONS, ensureSystemRoles } from './settings/permissions.js'
export { listRoles, getRole, createRole, updateRole, deleteRole } from './settings/roles.js'
export { listStaff, inviteStaff, joinBusiness, cancelInvite, updateStaffRole, suspendStaff, removeStaff, resendInvite } from './settings/staff.js'
export { getTransactionLock, updateTransactionLock } from './settings/transaction-lock.js'
export { listApprovals, reviewApproval } from './settings/approvals.js'
export { listAuditLog, createAuditEntry } from './settings/audit.js'
export { getAppSettings, updateAppSettings } from './settings/app-settings.js'
export { setPin, verifyPin, setOperationPin } from './settings/pin.js'
