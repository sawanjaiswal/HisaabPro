export interface AuthUser {
  id: string
  phone: string
  name: string | null
  email: string | null
  /** Primary business ID — populated after onboarding. Used by settings pages. */
  businessId: string | null
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
