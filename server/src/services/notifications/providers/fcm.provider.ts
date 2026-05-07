/**
 * Notification Engine — FCM Provider (PR4)
 *
 * Firebase Admin SDK wrapper for Android/iOS/Web push notifications.
 * Lazy-initialised on first send call — no crash at boot if env is absent.
 * Sends data-only messages (no `notification` block); client renders UI.
 *
 * Env vars (all optional — provider degrades gracefully when absent):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  Base64-encoded service account JSON (preferred)
 *
 * Error mapping:
 *   messaging/registration-token-not-registered → EXPIRED_TOKEN (non-retryable)
 *   messaging/invalid-argument                  → INVALID_RECIPIENT (non-retryable)
 *   5xx / quota errors                          → PROVIDER_DOWN (retryable)
 */

import type { NotificationProvider } from './notification-provider.js'
import type { DispatchResult, NotificationContext, RenderedTemplate } from '../notification-types.js'
import { NotificationErrorCode } from '../notification-errors.js'
import { providerRegistry } from './notification-provider.js'
import logger from '../../../lib/logger.js'
import { prisma } from '../../../lib/prisma.js'

// ---------------------------------------------------------------------------
// Firebase Admin lazy init
// ---------------------------------------------------------------------------

let _app: import('firebase-admin/app').App | null = null

function getFirebaseApp(): import('firebase-admin/app').App {
  if (_app) return _app

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require('firebase-admin') as typeof import('firebase-admin')

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set')
  }

  const serviceAccount = JSON.parse(
    Buffer.from(raw, 'base64').toString('utf8'),
  ) as import('firebase-admin').ServiceAccount

  _app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  return _app
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

interface FcmErrorCode {
  errorInfo?: { code?: string }
  code?: string
}

function classifyFcmError(err: FcmErrorCode): DispatchResult {
  const code: string =
    err.errorInfo?.code ?? err.code ?? 'unknown'

  const expiredCodes = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
  ]
  const invalidCodes = [
    'messaging/invalid-argument',
    'messaging/invalid-recipient',
  ]

  if (expiredCodes.some((c) => code.includes(c))) {
    return {
      success: false,
      costPaise: 0,
      errorCode: NotificationErrorCode.EXPIRED_TOKEN,
      errorMessage: code,
      retryable: false,
    }
  }

  if (invalidCodes.some((c) => code.includes(c))) {
    return {
      success: false,
      costPaise: 0,
      errorCode: NotificationErrorCode.INVALID_RECIPIENT,
      errorMessage: code,
      retryable: false,
    }
  }

  return {
    success: false,
    costPaise: 0,
    errorCode: NotificationErrorCode.PROVIDER_DOWN,
    errorMessage: code,
    retryable: true,
  }
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

const fcmProvider: NotificationProvider = {
  name: 'PUSH',

  isConfigured(): boolean {
    return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  },

  estimateCostPaise(): number {
    return 0
  },

  async send(
    ctx: NotificationContext,
    rendered: RenderedTemplate,
  ): Promise<DispatchResult> {
    // Resolve the most-recent valid FCM token for this user+business
    const pushToken = await prisma.pushToken.findFirst({
      where: {
        userId: ctx.userId,
        businessId: ctx.businessId,
        isValid: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    })

    if (!pushToken) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.INVALID_RECIPIENT,
        errorMessage: 'No valid FCM token found for user',
        retryable: false,
      }
    }

    const dataPayload: Record<string, string> = {
      title: rendered.title,
      body: rendered.body,
      ...(ctx.entityType ? { entityType: ctx.entityType } : {}),
      ...(ctx.entityId ? { entityId: ctx.entityId } : {}),
      ...(rendered.deepLinkUrl ? { deepLinkUrl: rendered.deepLinkUrl } : {}),
      ...rendered.payload.fcmData,
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMessaging } = require('firebase-admin/messaging') as typeof import('firebase-admin/messaging')

      const app = getFirebaseApp()
      const messageId = await getMessaging(app).send({
        token: pushToken.token,
        data: dataPayload,
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
      })

      logger.info('fcm.send.success', { userId: ctx.userId, messageId })

      return {
        success: true,
        externalId: messageId,
        costPaise: 0,
        retryable: false,
      }
    } catch (err) {
      logger.warn('fcm.send.error', { userId: ctx.userId, err })
      return classifyFcmError(err as FcmErrorCode)
    }
  },
}

// Register only when configured (fail-closed)
if (fcmProvider.isConfigured()) {
  providerRegistry.register('PUSH', fcmProvider)
}

export { fcmProvider }
