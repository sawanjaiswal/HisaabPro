/**
 * Admin Auth Service
 * Login, token refresh, account lockout, logout
 */

import { prisma } from '../../lib/prisma.js'
import { verifyPassword, hashPassword } from '../../lib/password.js'
import { generateAdminTokens } from '../../middleware/admin-auth.js'
import { notFoundError, unauthorizedError, validationError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import {
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  PROGRESSIVE_DELAY_PER_ATTEMPT_MS,
  MAX_PROGRESSIVE_DELAY_MS,
} from '../../config/security.js'

// --------------------------------------------------------------------------
// Login
// --------------------------------------------------------------------------

export async function adminLogin(email: string, password: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
      twoFactorEnabled: true,
    },
  })

  if (!admin) {
    // Constant-time delay to prevent user enumeration
    await _progressiveDelay(0)
    throw unauthorizedError('Invalid email or password')
  }

  if (!admin.isActive) {
    throw unauthorizedError('Admin account is inactive')
  }

  // Account lockout check
  if (admin.accountLockedUntil && admin.accountLockedUntil > new Date()) {
    const minutesLeft = Math.ceil((admin.accountLockedUntil.getTime() - Date.now()) / 60_000)
    throw validationError(`Account is temporarily locked. Try again in ${minutesLeft} minute(s).`)
  }

  // Progressive delay for brute-force mitigation
  await _progressiveDelay(admin.failedLoginAttempts)

  const passwordValid = await verifyPassword(password, admin.passwordHash)

  if (!passwordValid) {
    await _recordFailedLogin(admin.id, admin.failedLoginAttempts)
    throw unauthorizedError('Invalid email or password')
  }

  // Successful login — reset lockout fields
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastFailedLoginAt: null,
      lastLoginAt: new Date(),
    },
  })

  const { accessToken, refreshToken } = generateAdminTokens(admin.id, admin.email, admin.role)

  logger.info('Admin login success', { adminId: admin.id, email: admin.email, role: admin.role })

  return {
    accessToken,
    refreshToken,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      twoFactorEnabled: admin.twoFactorEnabled,
    },
  }
}

// --------------------------------------------------------------------------
// Me — fetch current admin profile
// --------------------------------------------------------------------------

export async function getAdminProfile(adminId: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })

  if (!admin) throw notFoundError('Admin')
  return admin
}

// --------------------------------------------------------------------------
// Refresh token
// --------------------------------------------------------------------------

import jwt from 'jsonwebtoken'
import type { AdminTokenPayload } from '../../middleware/admin-auth.js'

const JWT_SECRET = process.env.JWT_SECRET as string

export async function refreshAdminToken(refreshToken: string) {
  let decoded: AdminTokenPayload
  try {
    decoded = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'admin',
    }) as AdminTokenPayload

    if (decoded.type !== 'refresh') throw new Error('Expected refresh token')
  } catch {
    throw unauthorizedError('Invalid or expired refresh token')
  }

  // Verify admin still exists and is active
  const admin = await prisma.adminUser.findUnique({
    where: { id: decoded.adminId },
    select: { id: true, email: true, role: true, isActive: true },
  })

  if (!admin || !admin.isActive) {
    throw unauthorizedError('Admin account not found or inactive')
  }

  const tokens = generateAdminTokens(admin.id, admin.email, admin.role)
  return tokens
}

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

async function _recordFailedLogin(adminId: string, currentAttempts: number): Promise<void> {
  const newAttempts = currentAttempts + 1
  const shouldLock = newAttempts >= LOCKOUT_MAX_ATTEMPTS

  await prisma.adminUser.update({
    where: { id: adminId },
    data: {
      failedLoginAttempts: newAttempts,
      lastFailedLoginAt: new Date(),
      accountLockedUntil: shouldLock
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : undefined,
    },
  })
}

async function _progressiveDelay(attemptCount: number): Promise<void> {
  const delay = Math.min(
    attemptCount * PROGRESSIVE_DELAY_PER_ATTEMPT_MS,
    MAX_PROGRESSIVE_DELAY_MS
  )
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

// --------------------------------------------------------------------------
// Seed: create first SUPER_ADMIN (used in setup scripts only)
// --------------------------------------------------------------------------

export async function createAdminUser(
  email: string,
  password: string,
  name: string,
  role: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN'
) {
  const passwordHash = await hashPassword(password)
  return prisma.adminUser.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  })
}
