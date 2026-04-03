/**
 * PIN — user PIN and business operation PIN
 */

import { prisma } from '../../lib/prisma.js'
import { validationError, unauthorizedError } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import type { SetPinInput, VerifyPinInput } from '../../schemas/settings.schemas.js'

export async function setPin(userId: string, data: SetPinInput) {
  const existing = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: { pinHash: true },
  })

  // If PIN already set, verify current
  if (existing?.pinHash) {
    if (!data.currentPin) throw validationError('Current PIN is required')
    const valid = await verifyPassword(data.currentPin, existing.pinHash)
    if (!valid) throw unauthorizedError('Current PIN is incorrect')
  }

  const pinHash = await hashPassword(data.newPin)

  return prisma.userAppSettings.upsert({
    where: { userId },
    create: { userId, pinHash, pinEnabled: true },
    update: { pinHash, pinEnabled: true, pinAttempts: 0, pinLockedUntil: null },
    select: { pinEnabled: true },
  })
}

export async function verifyPin(userId: string, data: VerifyPinInput) {
  const settings = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: { pinHash: true, pinAttempts: true, pinLockedUntil: true },
  })
  if (!settings?.pinHash) throw validationError('PIN not set')

  // Check lockout
  if (settings.pinLockedUntil && settings.pinLockedUntil > new Date()) {
    throw validationError('PIN locked. Try again later.')
  }

  const valid = await verifyPassword(data.pin, settings.pinHash)

  if (!valid) {
    const newAttempts = settings.pinAttempts + 1
    const lockout = newAttempts >= 5
      ? new Date(Date.now() + 30 * 60 * 1000)
      : null

    await prisma.userAppSettings.update({
      where: { userId },
      data: { pinAttempts: newAttempts, pinLockedUntil: lockout },
    })

    return { valid: false, attemptsRemaining: Math.max(0, 5 - newAttempts) }
  }

  // Reset attempts on success
  await prisma.userAppSettings.update({
    where: { userId },
    data: { pinAttempts: 0, pinLockedUntil: null },
  })

  return { valid: true, attemptsRemaining: 5 }
}

// === Operation PIN (business-level) ===

export async function setOperationPin(
  businessId: string,
  data: { currentPin?: string; newPin: string }
) {
  const config = await prisma.transactionLockConfig.findUnique({
    where: { businessId },
    select: { operationPinHash: true },
  })

  // If PIN already set, verify current
  if (config?.operationPinHash) {
    if (!data.currentPin) throw validationError('Current operation PIN is required')
    const valid = await verifyPassword(data.currentPin, config.operationPinHash)
    if (!valid) throw unauthorizedError('Current operation PIN is incorrect')
  }

  const pinHash = await hashPassword(data.newPin)

  await prisma.transactionLockConfig.upsert({
    where: { businessId },
    create: { businessId, operationPinHash: pinHash },
    update: { operationPinHash: pinHash },
  })

  return { operationPinSet: true, updatedAt: new Date().toISOString() }
}
