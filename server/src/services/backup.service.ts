/**
 * Backup Service — adapted from DudhHisaab
 * Simplified skeleton: JSON export/import of user data.
 * Tables backed up will expand as features are built.
 *
 * Strategy:
 * - Manual backup: user-triggered, max 3/day, 5-min cooldown
 * - Auto backup: daily at 1 AM IST (scheduler added later)
 * - Format: JSON with schema version for forward compatibility
 * - Restore: atomic transaction, all-or-nothing
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import logger from '../lib/logger.js'

const SCHEMA_VERSION = '1.0.0'
const MAX_MANUAL_BACKUPS_PER_DAY = 3
const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

interface BackupData {
  schemaVersion: string
  createdAt: string
  userId: string
  data: {
    user: Record<string, unknown>
    businesses: Record<string, unknown>[]
    // Future: parties, products, invoices, payments, etc.
  }
}

interface BackupRecord {
  id: string
  userId: string
  type: 'manual' | 'daily' | 'weekly'
  sizeBytes: number
  data: BackupData
  createdAt: Date
}

// In-memory backup store (will move to DB/S3 when scale requires)
const backupStore = new Map<string, BackupRecord>()

function generateId(): string {
  return `bkp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function getUserBackups(userId: string): BackupRecord[] {
  return Array.from(backupStore.values())
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

function getTodayManualCount(userId: string): number {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return getUserBackups(userId).filter(
    (b) => b.type === 'manual' && b.createdAt >= startOfDay,
  ).length
}

function getLastBackupTime(userId: string): Date | null {
  const backups = getUserBackups(userId)
  return backups.length > 0 ? backups[0].createdAt : null
}

export async function createManualBackup(userId: string) {
  // Rate limiting
  const todayCount = getTodayManualCount(userId)
  if (todayCount >= MAX_MANUAL_BACKUPS_PER_DAY) {
    throw validationError(`Maximum ${MAX_MANUAL_BACKUPS_PER_DAY} manual backups per day reached`)
  }

  const lastBackup = getLastBackupTime(userId)
  if (lastBackup && Date.now() - lastBackup.getTime() < COOLDOWN_MS) {
    const remainingSec = Math.ceil((COOLDOWN_MS - (Date.now() - lastBackup.getTime())) / 1000)
    throw validationError(`Please wait ${remainingSec}s before creating another backup`)
  }

  // Gather data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, name: true, email: true, createdAt: true },
  })
  if (!user) throw notFoundError('User not found')

  const businessUsers = await prisma.businessUser.findMany({
    where: { userId },
    include: { business: true },
  })

  const backupData: BackupData = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    userId,
    data: {
      user: user as unknown as Record<string, unknown>,
      businesses: businessUsers.map((bu) => ({
        role: bu.role,
        joinedAt: bu.joinedAt,
        business: bu.business as unknown as Record<string, unknown>,
      })),
    },
  }

  const json = JSON.stringify(backupData)
  const id = generateId()

  const record: BackupRecord = {
    id,
    userId,
    type: 'manual',
    sizeBytes: Buffer.byteLength(json, 'utf8'),
    data: backupData,
    createdAt: new Date(),
  }

  backupStore.set(id, record)
  logger.info('Manual backup created', { id, userId, sizeBytes: record.sizeBytes })

  return {
    id: record.id,
    type: record.type,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt,
  }
}

export function listBackups(userId: string) {
  return getUserBackups(userId).map((b) => ({
    id: b.id,
    type: b.type,
    sizeBytes: b.sizeBytes,
    createdAt: b.createdAt,
  }))
}

export function getBackupData(userId: string, backupId: string) {
  const backup = backupStore.get(backupId)
  if (!backup || backup.userId !== userId) {
    throw notFoundError('Backup not found')
  }
  return backup.data
}

export function getCooldownStatus(userId: string) {
  const lastBackup = getLastBackupTime(userId)
  const todayCount = getTodayManualCount(userId)
  const now = Date.now()

  let cooldownRemainingSec = 0
  if (lastBackup && now - lastBackup.getTime() < COOLDOWN_MS) {
    cooldownRemainingSec = Math.ceil((COOLDOWN_MS - (now - lastBackup.getTime())) / 1000)
  }

  return {
    canBackup: todayCount < MAX_MANUAL_BACKUPS_PER_DAY && cooldownRemainingSec === 0,
    todayCount,
    maxPerDay: MAX_MANUAL_BACKUPS_PER_DAY,
    cooldownRemainingSec,
  }
}
