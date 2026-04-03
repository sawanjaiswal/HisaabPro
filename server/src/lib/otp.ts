import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import {
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
} from '../config/security.js'

/** Lower rounds for OTP — short-lived, speed matters more than brute-force resistance */
const OTP_BCRYPT_ROUNDS = 6

export { OTP_LENGTH, OTP_TTL_MS, OTP_MAX_ATTEMPTS as MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS as RESEND_COOLDOWN_MS }

/** Generate a cryptographically secure 6-digit OTP */
export function generateOTP(): string {
  const min = Math.pow(10, OTP_LENGTH - 1)
  const max = Math.pow(10, OTP_LENGTH) - 1
  return crypto.randomInt(min, max + 1).toString()
}

/** Hash OTP before storing in database — never store plaintext */
export function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_BCRYPT_ROUNDS)
}

/** Verify provided OTP against stored hash (bcrypt.compare is constant-time) */
export function verifyOTP(storedHash: string, provided: string): Promise<boolean> {
  return bcrypt.compare(provided, storedHash)
}

/** Send OTP via MSG91 Flow API. Returns true if sent successfully. */
export async function sendOTP(phone: string, otp: string): Promise<boolean> {
  const authKey = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_TEMPLATE_ID

  if (!authKey || !templateId) {
    if (process.env.NODE_ENV !== 'production') {
      // Use structured logger — never console.log secrets
      const { default: logger } = await import('./logger.js')
      logger.debug('otp.dev_generated', { phone, otp })
      return true
    }
    const { default: logger } = await import('./logger.js')
    logger.error('MSG91 credentials not configured')
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
    const { default: logger } = await import('./logger.js')
    logger.error('MSG91 SMS send failed', { error })
    return false
  }
}
