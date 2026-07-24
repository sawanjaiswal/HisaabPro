/**
 * App Settings — per-user app preferences
 */

import { prisma } from '../../lib/prisma.js'
import type { UpdateAppSettingsInput } from '../../schemas/settings.schemas.js'
import { createAuditEntry } from './audit.js'

export async function getAppSettings(userId: string) {
  const settings = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: {
      dateFormat: true, pinEnabled: true, biometricEnabled: true,
      calculatorPosition: true, language: true, theme: true,
    },
  })
  return settings || {
    dateFormat: 'DD/MM/YYYY',
    pinEnabled: false,
    biometricEnabled: false,
    calculatorPosition: 'BOTTOM_RIGHT',
    language: 'en',
    theme: 'light',
    operationPinSet: false,
  }
}

export async function updateAppSettings(
  userId: string,
  businessId: string,
  data: UpdateAppSettingsInput,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.userAppSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: {
        dateFormat: true, pinEnabled: true, biometricEnabled: true,
        calculatorPosition: true, language: true, theme: true,
      },
    })

    await createAuditEntry({
      businessId,
      entityType: 'AppSettings',
      entityId: userId,
      entityLabel: null,
      userId,
      action: 'UPDATE',
      changes: data as Record<string, unknown>,
    }, tx)

    return updated
  })
}
