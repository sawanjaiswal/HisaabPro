export interface AuthUser {
  id: string
  phone: string
  name: string | null
  email: string | null
  /** Primary business ID — populated after onboarding. */
  businessId: string | null
}

export interface BusinessSummary {
  id: string
  name: string
  businessType: string
  role: string
  roleId: string | null
  roleName: string
  /** Permission slugs granted by the user's custom role for this business. Empty for owners (owners bypass all checks server-side). */
  permissions: string[]
  status: string
  lastActiveAt: string | null
  /** Phase 6 #138 — member-level suspend timestamp (ISO 8601). null = active membership. */
  suspendedAt?: string | null
  suspendedById?: string | null
  /** Phase 6 #138 — firm-level suspend timestamp (ISO 8601). null = firm active. Set by owner via /:id/suspend. */
  businessSuspendedAt?: string | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface SendOtpResponse {
  message: string
}

export interface VerifyOtpResponse {
  isNewUser: boolean
  user: AuthUser
  tokens: AuthTokens
}

export type AuthStep = 'phone' | 'otp'
