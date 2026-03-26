/** Biometric Auth — pure utilities, storage helpers, and API fetch */

// ── Feature detection ──────────────────────────────────────────

export function isWebAuthnAvailable(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    navigator.credentials
  )
}

export async function isPlatformAuthAvailable(): Promise<boolean> {
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

export function getStoredCredential(): { credentialId: string; phone: string } | null {
  const credentialId = localStorage.getItem(KEY_CREDENTIAL_ID)
  const phone = localStorage.getItem(KEY_ENROLLED_PHONE)
  if (!credentialId || !phone) return null
  return { credentialId, phone }
}

export function saveStoredCredential(credentialId: string, phone: string): void {
  localStorage.setItem(KEY_CREDENTIAL_ID, credentialId)
  localStorage.setItem(KEY_ENROLLED_PHONE, phone)
  localStorage.setItem(KEY_ENROLLED, 'true')
}

export function removeStoredCredential(): void {
  localStorage.removeItem(KEY_CREDENTIAL_ID)
  localStorage.removeItem(KEY_ENROLLED_PHONE)
  localStorage.removeItem(KEY_ENROLLED)
}

export function isLocallyEnrolled(): boolean {
  return localStorage.getItem(KEY_ENROLLED) === 'true'
}

// ── Base64URL helpers ──────────────────────────────────────────

export function base64UrlDecode(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── API fetch helper ──────────────────────────────────────────

const API_BASE = '/api/auth/biometric'

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<{ success: boolean; data?: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  return res.json()
}
