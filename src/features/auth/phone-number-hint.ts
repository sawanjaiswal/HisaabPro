import { Capacitor, registerPlugin } from '@capacitor/core'

interface PhoneNumberHintPlugin {
  requestPhoneNumber(): Promise<{ phoneNumber: string | null; reason?: string }>
}

const PhoneNumberHint = registerPlugin<PhoneNumberHintPlugin>('PhoneNumberHint')

export type PhoneHintOutcome =
  | { kind: 'ok'; phoneNumber: string }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }

export function isPhoneHintAvailable(): boolean {
  return Capacitor.getPlatform() === 'android'
}

export async function requestPhoneNumberHint(): Promise<PhoneHintOutcome> {
  if (!isPhoneHintAvailable()) return { kind: 'unavailable' }
  try {
    const { phoneNumber, reason } = await PhoneNumberHint.requestPhoneNumber()
    if (typeof phoneNumber === 'string' && phoneNumber.length > 0) {
      return { kind: 'ok', phoneNumber }
    }
    return reason === 'cancelled' ? { kind: 'cancelled' } : { kind: 'unavailable' }
  } catch {
    return { kind: 'unavailable' }
  }
}

export function extractTenDigitNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length > 10) return digits.slice(-10)
  return null
}
