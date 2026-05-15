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
