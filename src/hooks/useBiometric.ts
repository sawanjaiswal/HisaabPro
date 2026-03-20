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

// ── Feature detection ──────────────────────────────────────────

function isWebAuthnAvailable(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    navigator.credentials
  )
}

async function isPlatformAuthAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// ── Local storage keys ─────────────────────────────────────────

const KEY_CREDENTIAL_ID = 'hp_biometric_credential_id'
const KEY_ENROLLED_PHONE = 'hp_biometric_phone'
const KEY_ENROLLED = 'hp_biometric_enrolled'

function getStoredCredential(): { credentialId: string; phone: string } | null {
  const credentialId = localStorage.getItem(KEY_CREDENTIAL_ID)
  const phone = localStorage.getItem(KEY_ENROLLED_PHONE)
  if (!credentialId || !phone) return null
  return { credentialId, phone }
}

function saveStoredCredential(credentialId: string, phone: string): void {
  localStorage.setItem(KEY_CREDENTIAL_ID, credentialId)
  localStorage.setItem(KEY_ENROLLED_PHONE, phone)
  localStorage.setItem(KEY_ENROLLED, 'true')
}

function removeStoredCredential(): void {
  localStorage.removeItem(KEY_CREDENTIAL_ID)
  localStorage.removeItem(KEY_ENROLLED_PHONE)
  localStorage.removeItem(KEY_ENROLLED)
}

function isLocallyEnrolled(): boolean {
  return localStorage.getItem(KEY_ENROLLED) === 'true'
}

// ── Base64URL helpers ──────────────────────────────────────────

function base64UrlDecode(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Server option interfaces ───────────────────────────────────

interface ServerRegistrationOptions {
  challenge: string
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    userVerification?: 'required' | 'preferred' | 'discouraged'
    residentKey?: 'required' | 'preferred' | 'discouraged'
  }
  timeout?: number
  attestation?: 'none' | 'direct' | 'indirect'
}

interface ServerAuthenticationOptions {
  challenge: string
  rpId: string
  timeout?: number
  userVerification?: 'required' | 'preferred' | 'discouraged'
  allowCredentials: Array<{
    type: 'public-key'
    id: string
    transports?: string[]
  }>
}

interface Credential {
  id: string
  credentialId: string
  deviceName: string | null
  createdAt: string
  lastUsedAt: string | null
}

// ── API base URL ───────────────────────────────────────────────

const API_BASE = '/api/auth/biometric'

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<{ success: boolean; data?: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  return res.json()
}

// ── Hook ───────────────────────────────────────────────────────

export interface UseBiometricReturn {
  /** True when the device hardware supports biometric authentication */
  isSupported: boolean
  /** True when the user has previously enrolled a credential on this device */
  isRegistered: boolean
  /** True while the initial availability check is in progress */
  checking: boolean
  /** Register a new biometric credential (call after password/OTP login) */
  register: (phone: string, deviceName?: string) => Promise<boolean>
  /** Authenticate with biometric (login flow) */
  authenticate: () => Promise<{ success: boolean; user?: Record<string, unknown> }>
  /** List of registered credentials */
  credentials: Credential[]
  /** Remove a specific credential by its DB id */
  removeCredential: (id: string) => Promise<void>
  /** Phone number of the enrolled credential (if any) */
  enrolledPhone: string | null
}

export function useBiometric(): UseBiometricReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [checking, setChecking] = useState(true)
  const [credentials, setCredentials] = useState<Credential[]>([])
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
      const res = await apiFetch<Credential[]>('/credentials')
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
