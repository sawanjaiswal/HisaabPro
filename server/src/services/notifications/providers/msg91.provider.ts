/**
 * Notification Engine — MSG91 SMS Provider (PR4)
 *
 * Sends transactional SMS via MSG91 Flow API (v5).
 * DLT template IDs are mandatory for Indian telecom compliance —
 * read from RenderedTemplate.payload.smsDltTemplateId.
 * Phone numbers must be E.164 Indian format: +91[6-9]\d{9}
 *
 * Env vars (optional — provider degrades gracefully when absent):
 *   MSG91_AUTH_KEY   MSG91 authentication key
 *   MSG91_SENDER_ID  DLT-registered sender ID (6 chars)
 *
 * Error mapping:
 *   Invalid phone      → INVALID_RECIPIENT (non-retryable)
 *   No DLT template    → INVALID_RECIPIENT (non-retryable)
 *   429 / flow-limit   → RATE_LIMITED (retryable)
 *   5xx / timeout      → PROVIDER_DOWN (retryable)
 */

import type { NotificationProvider } from './notification-provider.js'
import type { DispatchResult, NotificationContext, RenderedTemplate } from '../notification-types.js'
import { NotificationErrorCode } from '../notification-errors.js'
import { providerRegistry } from './notification-provider.js'
import logger from '../../../lib/logger.js'
import { prisma } from '../../../lib/prisma.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/'

/** India-only E.164: +91 followed by [6-9] and 9 more digits */
const INDIA_PHONE_RE = /^\+91[6-9]\d{9}$/

/** SMS truncation limit (DLT single-part) */
const SMS_MAX_CHARS = 160

// ---------------------------------------------------------------------------
// MSG91 API response shape
// ---------------------------------------------------------------------------

interface Msg91Response {
  type?: string
  message?: string
  request_id?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateIndianPhone(phone: string): boolean {
  return INDIA_PHONE_RE.test(phone)
}

/** Strip leading zeros, spaces, dashes; normalise Indian local to E.164 */
function normalisePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, '')
  if (stripped.startsWith('+91')) return stripped
  if (stripped.startsWith('91') && stripped.length === 12) return `+${stripped}`
  if (stripped.length === 10) return `+91${stripped}`
  return stripped
}

function truncateSms(text: string): string {
  return text.length > SMS_MAX_CHARS ? text.slice(0, SMS_MAX_CHARS - 1) + '…' : text
}

function classifyMsg91Error(status: number, body: string): DispatchResult {
  if (status === 429) {
    return {
      success: false,
      costPaise: 0,
      errorCode: NotificationErrorCode.RATE_LIMITED,
      errorMessage: body,
      retryable: true,
    }
  }
  if (status >= 500) {
    return {
      success: false,
      costPaise: 0,
      errorCode: NotificationErrorCode.PROVIDER_DOWN,
      errorMessage: body,
      retryable: true,
    }
  }
  return {
    success: false,
    costPaise: 0,
    errorCode: NotificationErrorCode.PROVIDER_DOWN,
    errorMessage: body,
    retryable: status >= 500,
  }
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

const msg91Provider: NotificationProvider = {
  name: 'SMS',

  isConfigured(): boolean {
    return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID)
  },

  estimateCostPaise(): number {
    return 25 // ~Rs 0.25 per SMS
  },

  async send(
    ctx: NotificationContext,
    rendered: RenderedTemplate,
  ): Promise<DispatchResult> {
    // 1. Require DLT template ID
    const dltTemplateId = rendered.payload.smsDltTemplateId
    if (!dltTemplateId) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.INVALID_RECIPIENT,
        errorMessage: 'SMS DLT template ID not set for this event — cannot send without DLT compliance',
        retryable: false,
      }
    }

    // 2. Resolve phone from DB
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { phone: true },
    })

    if (!user?.phone) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.INVALID_RECIPIENT,
        errorMessage: 'User has no phone number on file',
        retryable: false,
      }
    }

    const phone = normalisePhone(user.phone)

    if (!validateIndianPhone(phone)) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.INVALID_RECIPIENT,
        errorMessage: `Phone "${phone}" is not a valid Indian E.164 number`,
        retryable: false,
      }
    }

    // 3. Compose MSG91 Flow payload
    const smsBody = truncateSms(rendered.body)

    const payload = {
      template_id: dltTemplateId,
      sender: process.env.MSG91_SENDER_ID!,
      short_url: '0',
      mobiles: phone.replace('+', ''), // MSG91 expects digits only (91XXXXXXXXXX)
      body: smsBody,
    }

    // 4. Send request
    try {
      const resp = await fetch(MSG91_FLOW_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: process.env.MSG91_AUTH_KEY!,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      })

      const raw = await resp.text()

      if (!resp.ok) {
        logger.warn('msg91.send.http_error', { status: resp.status, userId: ctx.userId })
        return classifyMsg91Error(resp.status, raw)
      }

      let parsed: Msg91Response = {}
      try {
        parsed = JSON.parse(raw) as Msg91Response
      } catch {
        // non-JSON success response from MSG91 is still acceptable
      }

      if (parsed.type === 'error') {
        logger.warn('msg91.send.api_error', { message: parsed.message, userId: ctx.userId })
        return {
          success: false,
          costPaise: 0,
          errorCode: NotificationErrorCode.PROVIDER_DOWN,
          errorMessage: parsed.message,
          retryable: true,
        }
      }

      logger.info('msg91.send.success', { userId: ctx.userId, requestId: parsed.request_id })

      return {
        success: true,
        externalId: parsed.request_id,
        costPaise: 25,
        retryable: false,
      }
    } catch (err) {
      logger.warn('msg91.send.exception', { userId: ctx.userId, err })
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.PROVIDER_DOWN,
        errorMessage: String(err),
        retryable: true,
      }
    }
  },
}

// Register only when configured (fail-closed)
if (msg91Provider.isConfigured()) {
  providerRegistry.register('SMS', msg91Provider)
}

export { msg91Provider }
