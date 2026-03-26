/**
 * Biometric Auth Hook — Feature #59
 *
 * WebAuthn/FIDO2 biometric registration and authentication.
 * Adapted from DudhHisaab's useBiometricLogin.ts.
 *
 * Usage:
 *   const { isSupported, isRegistered, register, authenticate, credentials, removeCredential } = useBiometric()
 */

import { useState, useEffect, useCallback } from 'react'
import type { ServerRegistrationOptions, ServerAuthenticationOptions, BiometricCredential, UseBiometricReturn } from './biometric.types'
import {
  isPlatformAuthAvailable, isLocallyEnrolled, getStoredCredential,
  saveStoredCredential, removeStoredCredential,
  base64UrlDecode, arrayBufferToBase64Url, apiFetch,
} from './biometric.utils'

export type { UseBiometricReturn } from './biometric.types'

export function useBiometric(): UseBiometricReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [checking, setChecking] = useState(true)
  const [credentials, setCredentials] = useState<BiometricCredential[]>([])
  const [enrolledPhone, setEnrolledPhone] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const available = await isPlatformAuthAvailable()
      if (cancelled) return

      setIsSupported(available)

      if (available) {
        const enrolled = isLocallyEnrolled()
        setIsRegistered(enrolled)
        if (enrolled) {
          const stored = getStoredCredential()
          setEnrolledPhone(stored?.phone ?? null)
        }
      }

      setChecking(false)
    }

    check()
    return () => { cancelled = true }
  }, [])

  const register = useCallback(async (phone: string, deviceName?: string): Promise<boolean> => {
    if (!isSupported) return false

    try {
      // Step 1: Get challenge from server
      const beginRes = await apiFetch<{ options: ServerRegistrationOptions }>(
        '/register/options',
        { method: 'POST' }
      )
      if (!beginRes.success || !beginRes.data) return false

      const options = beginRes.data.options

      // Step 2: Create credential via platform authenticator
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: base64UrlDecode(options.challenge),
          rp: options.rp,
          user: {
            id: base64UrlDecode(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          authenticatorSelection: options.authenticatorSelection ?? {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: options.timeout ?? 60000,
          attestation: options.attestation ?? 'none',
        },
      })

      if (!credential || credential.type !== 'public-key') return false

      const pk = credential as PublicKeyCredential
      const response = pk.response as AuthenticatorAttestationResponse

      const credentialId = arrayBufferToBase64Url(pk.rawId)
      const attestationObject = arrayBufferToBase64Url(response.attestationObject)
      const clientDataJSON = arrayBufferToBase64Url(response.clientDataJSON)

      // Step 3: Send attestation to server for verification
      const verifyRes = await apiFetch('/register/verify', {
        method: 'POST',
        body: JSON.stringify({ credentialId, attestationObject, clientDataJSON, deviceName }),
      })

      if (!verifyRes.success) return false

      // Save locally for quick UI checks
      saveStoredCredential(credentialId, phone)
      setIsRegistered(true)
      setEnrolledPhone(phone)
      return true
    } catch {
      return false
    }
  }, [isSupported])

  const authenticate = useCallback(async (): Promise<{ success: boolean; user?: Record<string, unknown> }> => {
    if (!isSupported || !isRegistered) return { success: false }

    const stored = getStoredCredential()
    if (!stored) return { success: false }

    try {
      // Step 1: Get challenge from server
      const beginRes = await apiFetch<{ options: ServerAuthenticationOptions }>(
        '/authenticate/options',
        { method: 'POST', body: JSON.stringify({ phone: stored.phone }) }
      )
      if (!beginRes.success || !beginRes.data) return { success: false }

      const options = beginRes.data.options

      // Step 2: Get assertion from platform authenticator
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: base64UrlDecode(options.challenge),
          rpId: options.rpId,
          timeout: options.timeout ?? 60000,
          userVerification: options.userVerification ?? 'required',
          allowCredentials: options.allowCredentials.map((c) => ({
            type: c.type,
            id: base64UrlDecode(c.id),
            transports: c.transports as AuthenticatorTransport[] | undefined,
          })),
        },
      })

      if (!credential || credential.type !== 'public-key') return { success: false }

      const pk = credential as PublicKeyCredential
      const response = pk.response as AuthenticatorAssertionResponse

      // Step 3: Send assertion to server for verification + JWT tokens
      const verifyRes = await apiFetch<{ user: Record<string, unknown> }>(
        '/authenticate/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            credentialId: arrayBufferToBase64Url(pk.rawId),
            authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
            clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
            signature: arrayBufferToBase64Url(response.signature),
            phone: stored.phone,
          }),
        }
      )

      if (!verifyRes.success) return { success: false }

      return { success: true, user: verifyRes.data?.user }
    } catch {
      return { success: false }
    }
  }, [isSupported, isRegistered])

  const removeCredential = useCallback(async (id: string) => {
    await apiFetch(`/credentials/${id}`, { method: 'DELETE' })

    setCredentials((prev) => prev.filter((c) => c.id !== id))

    // If no credentials left, clear local enrollment
    const remaining = credentials.filter((c) => c.id !== id)
    if (remaining.length === 0) {
      removeStoredCredential()
      setIsRegistered(false)
      setEnrolledPhone(null)
    }
  }, [credentials])

  // Fetch credentials list when user is registered
  useEffect(() => {
    if (!isRegistered) return

    let cancelled = false

    const fetchCredentials = async () => {
      const res = await apiFetch<BiometricCredential[]>('/credentials')
      if (!cancelled && res.success && res.data) {
        setCredentials(res.data)
      }
    }

    fetchCredentials()
    return () => { cancelled = true }
  }, [isRegistered])

  return {
    isSupported,
    isRegistered,
    checking,
    register,
    authenticate,
    credentials,
    removeCredential,
    enrolledPhone,
  }
}
