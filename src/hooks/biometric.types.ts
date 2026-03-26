/** Biometric Auth — types and interfaces */

export interface ServerRegistrationOptions {
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

export interface ServerAuthenticationOptions {
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

export interface BiometricCredential {
  id: string
  credentialId: string
  deviceName: string | null
  createdAt: string
  lastUsedAt: string | null
}

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
  credentials: BiometricCredential[]
  /** Remove a specific credential by its DB id */
  removeCredential: (id: string) => Promise<void>
  /** Phone number of the enrolled credential (if any) */
  enrolledPhone: string | null
}
