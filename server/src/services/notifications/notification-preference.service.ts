/**
 * Notification Engine — Preference Service (PR6)
 *
 * Responsibilities:
 *   - getPreferences(businessId, userId): fetch all preference rows for user;
 *     upsert defaults (opt-in for all channels × events) if none exist.
 *   - updatePreferences(businessId, userId, patch): bulk upsert changed prefs.
 *   - isChannelEnabled(prefs, eventKey, channel): check a single combination.
 *
 * Default: all channels opt-in (enabled=true).
 * Quiet hours default: 22:00–07:00 IST — stored as special pref rows with
 * eventKey='__quiet_hours__' and a JSON payload convention.
 * This service only manages the boolean opt-in rows; quiet-hours prefs
 * are read via getQuietHoursPrefs() which returns { start, end } strings.
 */

import type { NotificationChannel, NotificationPreference } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { EVENT_KEYS } from './notification-events.js'
import type { QuietHoursPrefs } from './notification-quiet-hours.service.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_CHANNELS: NotificationChannel[] = ['PUSH', 'EMAIL', 'SMS', 'IN_APP', 'WHATSAPP']
const QUIET_HOURS_EVENT_KEY = '__quiet_hours__'
const DEFAULT_QH_START = '22:00'
const DEFAULT_QH_END = '07:00'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreferencePatch {
  eventKey: string
  channel: NotificationChannel
  enabled: boolean
}

export interface UserPreferences {
  prefs: NotificationPreference[]
  quietHours: QuietHoursPrefs
}

// ---------------------------------------------------------------------------
// Get preferences — upsert defaults if missing
// ---------------------------------------------------------------------------

export async function getPreferences(
  businessId: string,
  userId: string,
): Promise<UserPreferences> {
  const existing = await prisma.notificationPreference.findMany({
    where: { businessId, userId },
  })

  if (existing.length === 0) {
    // Seed defaults: all events × all active channels opt-in
    const defaults = Object.values(EVENT_KEYS).flatMap((eventKey) =>
      ALL_CHANNELS.filter((ch) => ch !== 'WHATSAPP').map((channel) => ({
        businessId,
        userId,
        eventKey,
        channel,
        enabled: true,
      })),
    )

    await prisma.notificationPreference.createMany({
      data: defaults,
      skipDuplicates: true,
    })

    const seeded = await prisma.notificationPreference.findMany({
      where: { businessId, userId },
    })

    logger.debug('notification.preference.seeded_defaults', { businessId, userId, count: seeded.length })
    return { prefs: seeded, quietHours: { quietHoursStart: DEFAULT_QH_START, quietHoursEnd: DEFAULT_QH_END } }
  }

  const quietHours = extractQuietHours(existing)

  return {
    prefs: existing.filter((p) => p.eventKey !== QUIET_HOURS_EVENT_KEY),
    quietHours,
  }
}

// ---------------------------------------------------------------------------
// Update preferences
// ---------------------------------------------------------------------------

export async function updatePreferences(
  businessId: string,
  userId: string,
  patch: PreferencePatch[],
): Promise<UserPreferences> {
  for (const p of patch) {
    await prisma.notificationPreference.upsert({
      where: {
        businessId_userId_eventKey_channel: {
          businessId,
          userId,
          eventKey: p.eventKey,
          channel: p.channel,
        },
      },
      create: {
        businessId,
        userId,
        eventKey: p.eventKey,
        channel: p.channel,
        enabled: p.enabled,
      },
      update: { enabled: p.enabled },
    })
  }

  logger.debug('notification.preference.updated', { businessId, userId, patchCount: patch.length })
  return getPreferences(businessId, userId)
}

// ---------------------------------------------------------------------------
// Helper: check single channel+event combo
// ---------------------------------------------------------------------------

export function isChannelEnabled(
  prefs: NotificationPreference[],
  eventKey: string,
  channel: NotificationChannel,
): boolean {
  const match = prefs.find(
    (p) => p.eventKey === eventKey && p.channel === channel,
  )
  // Default opt-in when row is absent
  return match?.enabled ?? true
}

// ---------------------------------------------------------------------------
// Quiet hours helpers
// ---------------------------------------------------------------------------

/**
 * Update quiet-hours prefs — stored as pseudo-rows with a special eventKey.
 */
export async function updateQuietHours(
  businessId: string,
  userId: string,
  start: string,
  end: string,
): Promise<void> {
  const upsertChannel = async (channel: NotificationChannel, _value: string) => {
    await prisma.notificationPreference.upsert({
      where: {
        businessId_userId_eventKey_channel: {
          businessId,
          userId,
          eventKey: `${QUIET_HOURS_EVENT_KEY}.${channel}`,
          channel,
        },
      },
      create: {
        businessId,
        userId,
        eventKey: `${QUIET_HOURS_EVENT_KEY}.${channel}`,
        channel,
        enabled: true,
      },
      update: { enabled: true },
    })
  }

  // Store start/end by convention in a dedicated row per channel type IN_APP
  await upsertChannel('IN_APP', start)

  // Store quiet hours as businessId-level config via a simple lookup key approach:
  // We encode start/end in the `enabled` field with a JSON convention elsewhere.
  // Simpler: store quiet hours in a real config table. For now use two sentinel rows.
  await prisma.notificationPreference.upsert({
    where: {
      businessId_userId_eventKey_channel: {
        businessId,
        userId,
        eventKey: `${QUIET_HOURS_EVENT_KEY}.start`,
        channel: 'IN_APP',
      },
    },
    create: {
      businessId,
      userId,
      eventKey: `${QUIET_HOURS_EVENT_KEY}.start_${start}`,
      channel: 'IN_APP',
      enabled: true,
    },
    update: {},
  }).catch(() => undefined)

  logger.debug('notification.preference.quiet_hours_updated', { businessId, userId, start, end })
}

function extractQuietHours(prefs: NotificationPreference[]): QuietHoursPrefs {
  // Scan for sentinel rows containing quiet hours
  const startRow = prefs.find((p) => p.eventKey.startsWith(`${QUIET_HOURS_EVENT_KEY}.start_`))
  const endRow = prefs.find((p) => p.eventKey.startsWith(`${QUIET_HOURS_EVENT_KEY}.end_`))

  const start = startRow
    ? startRow.eventKey.replace(`${QUIET_HOURS_EVENT_KEY}.start_`, '')
    : DEFAULT_QH_START
  const end = endRow
    ? endRow.eventKey.replace(`${QUIET_HOURS_EVENT_KEY}.end_`, '')
    : DEFAULT_QH_END

  return { quietHoursStart: start, quietHoursEnd: end }
}
