import { prisma } from '../../lib/prisma.js'
import { generateOTP, hashOTP, verifyOTP, sendOTP, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS } from '../../lib/otp.js'
import { generateTokens } from '../../lib/jwt.js'
import bcrypt from 'bcryptjs'
import type { RegisterInput, VerifyRegistrationInput } from '../../schemas/auth.schemas.js'
import { DEFAULT_CATEGORIES } from '../../config/defaults.js'
import { ensureSystemRoles } from '../settings.service.js'
import { seedDefaultAccounts } from '../accounting/chart-of-accounts.js'
import { ensurePredefinedUnits } from '../unit/constants.js'
import { getMe } from './me.js'

const PASSWORD_BCRYPT_ROUNDS = 10

/**
 * Atomically create a user, their default business workspace, owner membership,
 * default categories, system roles, and GL accounts in a single transaction.
 */
export async function createUserWithDefaultBusiness(params: {
  phone: string
  name: string
  passwordHash?: string | null
  email?: string | null
  businessName?: string
}) {
  const { phone, name, passwordHash, email, businessName } = params
  const firmName = businessName?.trim() || `${name}'s Business`

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        phone,
        name,
        email: email ? email.trim().toLowerCase() : null,
        passwordHash: passwordHash || null,
      },
      select: { id: true, phone: true, name: true, email: true },
    })

    // 2. Create default Business
    const business = await tx.business.create({
      data: {
        name: firmName,
        phone,
        businessType: 'general',
        currencyCode: 'INR',
      },
      select: {
        id: true,
        name: true,
        businessType: true,
        currencyCode: true,
        isActive: true,
        createdAt: true,
      },
    })

    // 3. Create BusinessUser owner membership
    await tx.businessUser.create({
      data: {
        userId: user.id,
        businessId: business.id,
        role: 'owner',
        status: 'ACTIVE',
        isActive: true,
      },
    })

    // 4. Seed default categories
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        businessId: business.id,
        name: cat.name,
        type: 'PREDEFINED',
        color: cat.color,
        sortOrder: cat.sortOrder,
      })),
    })

    // 5. Update user's lastActiveBusinessId
    await tx.user.update({
      where: { id: user.id },
      data: { lastActiveBusinessId: business.id },
    })

    return { user, business }
  })

  // Seed system roles, default accounts & predefined units for the new business
  await ensureSystemRoles(result.business.id)
  await seedDefaultAccounts(result.business.id)
  await ensurePredefinedUnits(result.business.id)

  const tokens = generateTokens(result.user.id, result.user.phone, result.business.id)
  const meData = await getMe(result.user.id, result.business.id)

  return {
    user: result.user,
    business: result.business,
    businesses: meData?.businesses ?? [],
    activeBusiness: meData?.activeBusiness ?? null,
    tokens,
  }
}

/**
 * Direct registration — creates user + default business atomically and returns session.
 */
export async function directRegister(data: RegisterInput) {
  const { name, phone, email, password, businessName } = data

  const existingPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
  if (existingPhone) {
    return { success: false, message: 'This phone number is already registered. Please log in.' }
  }

  if (email && email.trim()) {
    const existingEmail = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    })
    if (existingEmail) {
      return { success: false, message: 'This email address is already registered. Please log in.' }
    }
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS)
  const created = await createUserWithDefaultBusiness({
    phone,
    name: name.trim(),
    email: email && email.trim() ? email.trim().toLowerCase() : undefined,
    passwordHash,
    businessName,
  })

  return {
    success: true,
    message: 'Registration successful',
    isNewUser: true,
    user: created.user,
    businesses: created.businesses,
    activeBusiness: created.activeBusiness,
    tokens: created.tokens,
  }
}

/**
 * Register step 1 (OTP flow): validate phone not taken, hash password, store in OtpCode context, send OTP.
 */
export async function register(data: RegisterInput) {
  const { name, phone, password, businessName } = data

  // Check phone not already registered
  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
  if (existing) {
    return { sent: false, message: 'This phone number is already registered. Please log in.' }
  }

  // Hash password before storing
  const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS)

  // Check resend cooldown
  const recent = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime()
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
      return { sent: false, message: `Please wait ${waitSec}s before requesting a new OTP` }
    }
  }

  const otp = generateOTP()
  const otpHash = await hashOTP(otp)

  await prisma.otpCode.create({
    data: {
      phone,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      context: JSON.stringify({ purpose: 'registration', name, passwordHash, businessName }),
    },
  })

  const sent = await sendOTP(phone, otp)
  if (!sent && process.env.NODE_ENV === 'production') {
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return { sent: true, message: `OTP sent to ${phone}` }
}

/**
 * Verify registration OTP and create user + business account.
 */
export async function verifyRegistration(data: VerifyRegistrationInput) {
  const { phone, otp } = data

  const otpRecord = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    return { verified: false, message: 'No OTP found. Please request a new one.' }
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })
    return { verified: false, message: 'OTP expired. Please request a new one.' }
  }

  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })
    return { verified: false, message: 'Too many failed attempts. Please request a new OTP.' }
  }

  if (!(await verifyOTP(otpRecord.code, otp))) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { attempts: { increment: 1 } } })
    const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1
    return { verified: false, message: `Invalid OTP. ${remaining} attempts remaining.` }
  }

  // Parse registration context
  let ctx: { purpose?: string; name?: string; passwordHash?: string; businessName?: string } = {}
  try {
    ctx = otpRecord.context ? JSON.parse(otpRecord.context) as typeof ctx : {}
  } catch { /* ignore */ }

  if (ctx.purpose !== 'registration' || !ctx.name || !ctx.passwordHash) {
    return { verified: false, message: 'Invalid registration session. Please start again.' }
  }

  // Mark OTP consumed
  await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { verified: true } })

  // Check phone not taken (race condition guard)
  const existingUser = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
  if (existingUser) {
    return { verified: false, message: 'This phone number is already registered. Please log in.' }
  }

  const created = await createUserWithDefaultBusiness({
    phone,
    name: ctx.name,
    passwordHash: ctx.passwordHash,
    businessName: ctx.businessName,
  })

  return {
    verified: true,
    message: 'Registration successful',
    isNewUser: true,
    user: created.user,
    businesses: created.businesses,
    activeBusiness: created.activeBusiness,
    tokens: created.tokens,
  }
}

/**
 * Resend OTP — enforces 30s cooldown, only for unverified phones.
 */
export async function resendOtp(phone: string) {
  const recent = await prisma.otpCode.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!recent) {
    return { sent: false, message: 'No pending OTP found. Please start registration again.' }
  }

  const elapsed = Date.now() - recent.createdAt.getTime()
  if (elapsed < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
    return { sent: false, message: `Please wait ${waitSec}s before requesting a new OTP` }
  }

  // Invalidate old OTP
  await prisma.otpCode.update({ where: { id: recent.id }, data: { verified: true } })

  const otp = generateOTP()
  const otpHash = await hashOTP(otp)

  await prisma.otpCode.create({
    data: {
      phone,
      code: otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      context: recent.context, // carry over registration context
    },
  })

  const sent = await sendOTP(phone, otp)
  if (!sent && process.env.NODE_ENV === 'production') {
    return { sent: false, message: 'Failed to send OTP. Please try again.' }
  }

  return {
    sent: true,
    message: `OTP resent to ${phone}`,
    resendAvailableAt: new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString(),
  }
}
