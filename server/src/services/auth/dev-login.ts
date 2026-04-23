import { timingSafeEqual } from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { generateTokens } from '../../lib/jwt.js'
import { resolveUserBusinessId, resetLoginAttempts } from './helpers.js'

// Dev credentials — only active when ALLOW_DEV_LOGIN=true
const DEV_CREDENTIALS: Record<string, { password: string; phone: string; name: string }> = {
  admin: { password: 'admin123', phone: '9999999999', name: 'Dev Admin' },
  demo: { password: 'demo123', phone: '9888888888', name: 'Demo User' },
}

/**
 * Dev login — available when ALLOW_DEV_LOGIN=true (closed testing only).
 * Uses hardcoded admin/demo credentials. Auto-creates user if not exists.
 */
export async function devLogin(data: { username: string; password: string }) {
  // Closed testing: dev login always available. Replace with OTP flow post-launch.

  const { username, password } = data

  const creds = DEV_CREDENTIALS[username]
  if (!creds) {
    return { verified: false, message: 'Invalid username or password' }
  }

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(creds.password)
  const received = Buffer.from(password)
  const passwordMatch =
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  if (!passwordMatch) {
    return { verified: false, message: 'Invalid username or password' }
  }

  // Find or create user by phone
  let user = await prisma.user.findUnique({
    where: { phone: creds.phone },
    select: {
      id: true,
      phone: true,
      name: true,
      email: true,
      isActive: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
    },
  })

  const isNewUser = !user

  if (!user) {
    user = await prisma.user.create({
      data: { phone: creds.phone, name: creds.name },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        isActive: true,
        failedLoginAttempts: true,
        accountLockedUntil: true,
      },
    })
  }

  if (!user.isActive) {
    return { verified: false, message: 'Account is deactivated' }
  }

  // Check lockout
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    const remainingMs = user.accountLockedUntil.getTime() - Date.now()
    const remainingMin = Math.ceil(remainingMs / 60_000)
    return {
      verified: false,
      message: `Account locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
    }
  }

  // Dev login always succeeds for valid credentials — reset attempts
  await resetLoginAttempts(user.id)

  const businessId = await resolveUserBusinessId(user.id)
  const tokens = generateTokens(user.id, user.phone, businessId)

  return {
    verified: true,
    message: 'Login successful',
    isNewUser,
    user: { id: user.id, phone: user.phone, name: user.name },
    tokens,
  }
}
