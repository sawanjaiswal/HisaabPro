// Native Google SSO adapter:
// The ONLY file that knows @capawesome/capacitor-google-sign-in exists.
// Uses Android Credential Manager to open the OS Google Account picker
// bottom sheet directly INSIDE the app (no external browser / Custom Tab).
import { Capacitor } from '@capacitor/core'

/** True only on Android native platform where Credential Manager is available */
export function isNativeGoogleAvailable(): boolean {
  return Capacitor.getPlatform() === 'android'
}

export type NativeGoogleOutcome =
  | { kind: 'ok'; idToken: string }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'failed' }

function classify(code: unknown, message: unknown): NativeGoogleOutcome {
  const c = String(code ?? '')
  const m = String(message ?? '')
  if (c === 'SIGN_IN_CANCELED' || /cancell?ed/i.test(m)) return { kind: 'cancelled' }
  if (c === 'NO_CREDENTIAL' || /no credential|NoCredentialException/i.test(m)) {
    return { kind: 'unavailable' }
  }
  return { kind: 'failed' }
}

/**
 * Raise the OS native Google Account picker sheet and return the Google idToken.
 */
export async function nativeGoogleSignIn(args: {
  clientId?: string
  nonce?: string
}): Promise<NativeGoogleOutcome> {
  try {
    const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in')
    if (args.clientId) {
      await GoogleSignIn.initialize({ clientId: args.clientId })
    }
    const result = await GoogleSignIn.signIn({ nonce: args.nonce })
    if (typeof result.idToken !== 'string' || result.idToken.length === 0) {
      return { kind: 'failed' }
    }
    return { kind: 'ok', idToken: result.idToken }
  } catch (err) {
    const e = err as { code?: unknown; message?: unknown }
    return classify(e?.code, e?.message)
  }
}
