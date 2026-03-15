import crypto from 'crypto'

const OTP_LENGTH = 6
const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_MS = 30 * 1000 // 30 seconds

export { OTP_LENGTH, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS }

/** Generate a cryptographically secure 6-digit OTP */
export function generateOTP(): string {
  const min = Math.pow(10, OTP_LENGTH - 1)
  const max = Math.pow(10, OTP_LENGTH) - 1
  return crypto.randomInt(min, max + 1).toString()
}

/** Constant-time OTP comparison to prevent timing attacks */
export function verifyOTP(stored: string, provided: string): boolean {
  if (stored.length !== provided.length) return false
  const a = Buffer.from(stored, 'utf8')
  const b = Buffer.from(provided, 'utf8')
  return crypto.timingSafeEqual(a, b)
}

/** Send OTP via MSG91 Flow API. Returns true if sent successfully. */
export async function sendOTP(phone: string, otp: string): Promise<boolean> {
  const authKey = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_TEMPLATE_ID

  if (!authKey || !templateId) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`)
      return true
    }
    console.error('MSG91 credentials not configured')
    return false
  }

  try {
    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: '0',
        recipients: [{ mobiles: `91${phone}`, otp }],
      }),
    })

    const data = (await response.json()) as { type?: string }
    return data.type === 'success'
  } catch (error) {
    console.error('MSG91 SMS send failed:', error)
    return false
  }
}
