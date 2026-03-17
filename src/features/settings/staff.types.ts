// ─── Staff ───────────────────────────────────────────────────────────────────

export type StaffStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING'

export interface StaffMember {
  id: string
  userId: string
  name: string
  phone: string
  role: { id: string; name: string }
  status: StaffStatus
  lastActiveAt: string | null
  invitedBy: string
  joinedAt: string
}

export interface StaffInvite {
  id: string
  name: string
  phone: string
  roleName: string
  status: 'PENDING' | 'EXPIRED'
  expiresAt: string
}

export interface StaffListResponse {
  success: boolean
  data: {
    staff: StaffMember[]
    pending: StaffInvite[]
  }
}

export interface InviteStaffData {
  name: string
  phone: string
  roleId: string
}

export interface InviteResponse {
  success: boolean
  data: {
    invite: {
      id: string
      code: string
      expiresAt: string
      status: string
      staffName: string
      staffPhone: string
      roleName: string
    }
  }
}
