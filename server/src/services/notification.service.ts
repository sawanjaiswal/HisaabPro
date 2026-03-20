/**
 * Unified Notification Service — Email (Resend), WhatsApp (Aisensy), Push (FCM)
 * All channels gracefully degrade when API keys are not configured.
 */

import logger from '../lib/logger.js'

// ============================================================
// Types
// ============================================================

interface EmailAttachment {
  filename: string
  content: Buffer
}

interface SendEmailOpts {
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
}

interface SendWhatsAppOpts {
  phone: string
  templateName: string
  templateParams: string[]
  mediaUrl?: string
}

interface SendPushOpts {
  deviceTokens: string[]
  title: string
  body: string
  data?: Record<string, string>
}

interface ChannelResult {
  success: boolean
  id?: string
  successCount?: number
  error?: string
}

interface NotifyOpts {
  userId: string
  channel: 'EMAIL' | 'WHATSAPP' | 'PUSH' | 'ALL'
  email?: SendEmailOpts
  whatsapp?: SendWhatsAppOpts
  push?: SendPushOpts
}

interface NotifyResult {
  email?: ChannelResult
  whatsapp?: ChannelResult
  push?: ChannelResult
}

// ============================================================
// Lazy-initialized clients (avoid import-time crashes)
// ============================================================

let resendClient: import('resend').Resend | null = null

function getResendClient(): import('resend').Resend | null {
  if (resendClient) return resendClient
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null

  // Dynamic import already done at module level via lazy init
  const { Resend } = require('resend') as typeof import('resend')
  resendClient = new Resend(apiKey)
  return resendClient
}

let firebaseInitialized = false

async function getFirebaseMessaging(): Promise<import('firebase-admin').messaging.Messaging | null> {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountJson) return null

  if (!firebaseInitialized) {
    const admin = await import('firebase-admin')
    try {
      const serviceAccount = JSON.parse(serviceAccountJson) as import('firebase-admin').ServiceAccount
      admin.default.initializeApp({
        credential: admin.default.credential.cert(serviceAccount),
      })
      firebaseInitialized = true
    } catch (err) {
      logger.error('Failed to initialize Firebase Admin', { error: err })
      return null
    }
  }

  const admin = await import('firebase-admin')
  return admin.default.messaging()
}

// ============================================================
// Email — Resend
// ============================================================

const RESEND_FROM = process.env.RESEND_FROM_EMAIL ?? 'HisaabPro <noreply@hisaabpro.in>'

export async function sendEmail(opts: SendEmailOpts): Promise<ChannelResult> {
  const client = getResendClient()
  if (!client) {
    logger.warn('sendEmail skipped: RESEND_API_KEY not configured')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: RESEND_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
      })),
    })

    if (error) {
      logger.error('Resend email failed', { to: opts.to, error })
      return { success: false, error: error.message }
    }

    logger.info('Email sent', { to: opts.to, id: data?.id })
    return { success: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    logger.error('sendEmail exception', { to: opts.to, error: message })
    return { success: false, error: message }
  }
}

// ============================================================
// WhatsApp — Aisensy (REST API)
// ============================================================

const AISENSY_ENDPOINT = 'https://backend.aisensy.com/campaign/t1/api/v2'

export async function sendWhatsApp(opts: SendWhatsAppOpts): Promise<ChannelResult> {
  const apiKey = process.env.AISENSY_API_KEY
  if (!apiKey) {
    logger.warn('sendWhatsApp skipped: AISENSY_API_KEY not configured')
    return { success: false, error: 'AISENSY_API_KEY not configured' }
  }

  try {
    const payload: Record<string, unknown> = {
      apiKey,
      campaignName: opts.templateName,
      destination: opts.phone,
      userName: 'HisaabPro',
      templateParams: opts.templateParams,
    }
    if (opts.mediaUrl) {
      payload.mediaUrl = opts.mediaUrl
    }

    const response = await fetch(AISENSY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const body = await response.text()
      logger.error('Aisensy WhatsApp failed', { phone: opts.phone, status: response.status, body })
      return { success: false, error: `Aisensy returned ${response.status}` }
    }

    const data = await response.json() as { id?: string }
    logger.info('WhatsApp sent', { phone: opts.phone, id: data.id })
    return { success: true, id: data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown WhatsApp error'
    logger.error('sendWhatsApp exception', { phone: opts.phone, error: message })
    return { success: false, error: message }
  }
}

// ============================================================
// Push Notification — FCM via firebase-admin
// ============================================================

export async function sendPushNotification(opts: SendPushOpts): Promise<ChannelResult> {
  if (opts.deviceTokens.length === 0) {
    return { success: false, error: 'No device tokens provided' }
  }

  const messaging = await getFirebaseMessaging()
  if (!messaging) {
    logger.warn('sendPushNotification skipped: FIREBASE_SERVICE_ACCOUNT not configured')
    return { success: false, error: 'FIREBASE_SERVICE_ACCOUNT not configured' }
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens: opts.deviceTokens,
      notification: { title: opts.title, body: opts.body },
      data: opts.data,
    })

    logger.info('Push notifications sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    })

    if (response.failureCount > 0) {
      const errors = response.responses
        .filter(r => !r.success)
        .map(r => r.error?.message)
        .slice(0, 5) // log first 5 errors max
      logger.warn('Some push notifications failed', { errors })
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      error: response.failureCount > 0
        ? `${response.failureCount} of ${opts.deviceTokens.length} failed`
        : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown push error'
    logger.error('sendPushNotification exception', { error: message })
    return { success: false, error: message }
  }
}

// ============================================================
// Unified notify — dispatch to one or all channels
// ============================================================

export async function notify(opts: NotifyOpts): Promise<NotifyResult> {
  const result: NotifyResult = {}
  const sendAll = opts.channel === 'ALL'

  const tasks: Promise<void>[] = []

  if ((sendAll || opts.channel === 'EMAIL') && opts.email) {
    tasks.push(
      sendEmail(opts.email).then(r => { result.email = r })
    )
  }

  if ((sendAll || opts.channel === 'WHATSAPP') && opts.whatsapp) {
    tasks.push(
      sendWhatsApp(opts.whatsapp).then(r => { result.whatsapp = r })
    )
  }

  if ((sendAll || opts.channel === 'PUSH') && opts.push) {
    tasks.push(
      sendPushNotification(opts.push).then(r => { result.push = r })
    )
  }

  await Promise.all(tasks)

  logger.info('notify completed', { userId: opts.userId, channel: opts.channel, result })
  return result
}
