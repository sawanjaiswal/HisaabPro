import { api } from '@/lib/api'
import type { SsoAuthResponse, SsoNativeStartResult, SsoProvider } from './sso.types'

export async function getSsoConfig(provider: SsoProvider = 'google'): Promise<{ clientId: string | null }> {
  return api<{ clientId: string | null }>(`/auth/sso/${provider}/config`, {
    _skipRefresh: true,
  })
}

export async function startNativeSso(provider: SsoProvider = 'google'): Promise<SsoNativeStartResult> {
  return api<SsoNativeStartResult>(`/auth/sso/${provider}/start-native`, {
    method: 'POST',
    _skipRefresh: true,
  })
}

export async function exchangeNativeSso(
  provider: SsoProvider = 'google',
  body: { idToken?: string; accessToken?: string; sealedTx?: string; nonce?: string },
): Promise<SsoAuthResponse> {
  return api<SsoAuthResponse>(`/auth/sso/${provider}/exchange-native`, {
    method: 'POST',
    body: JSON.stringify(body),
    _skipRefresh: true,
  })
}
