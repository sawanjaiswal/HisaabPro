import type { AuthUser, BusinessSummary } from './auth.types'

export type SsoProvider = 'google'

export type SsoState = 'idle' | 'authenticating' | 'success' | 'error'

export type SsoErrorCode =
  | 'SSO_CANCELLED'
  | 'SSO_UNAVAILABLE'
  | 'SSO_TOKEN_INVALID'
  | 'SSO_EXCHANGE_FAILED'

export interface SsoNativeStartResult {
  sealedTx: string
  nonce: string
  clientId?: string
  handoffKey: string
}

export interface SsoAuthResponse {
  user: AuthUser
  businesses: BusinessSummary[]
  activeBusiness: BusinessSummary | null
  tokens?: {
    accessToken: string
    refreshToken: string
  }
}
