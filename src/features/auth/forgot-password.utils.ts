export type Step = 'phone' | 'verify' | 'success'

export const OTP_TTL_SEC = 5 * 60
export const RESEND_COOLDOWN_SEC = 30
export const phoneRegex = /^[6-9]\d{9}$/

export function maskPhone(phone: string) {
  return `+91 ${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}`
}

export const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
