/**
 * Notification Engine — Resend Email Provider (PR4)
 *
 * Uses the `resend` SDK to dispatch transactional emails.
 * Wraps body in a minimal brand header + plain <p> — no external CSS.
 * Supports optional PDF attachment via base64-encoded content.
 *
 * Env vars (optional — provider degrades gracefully when absent):
 *   RESEND_API_KEY      Resend API key (re_...)
 *   RESEND_FROM_EMAIL   Sender address (e.g. "HisaabPro <noreply@hisaabpro.in>")
 *
 * Error mapping:
 *   422 invalid recipient → INVALID_RECIPIENT (non-retryable)
 *   429 rate limit        → RATE_LIMITED (retryable)
 *   5xx                   → PROVIDER_DOWN (retryable)
 */

import type { NotificationProvider } from './notification-provider.js'
import type { DispatchResult, NotificationContext, RenderedTemplate } from '../notification-types.js'
import { NotificationErrorCode } from '../notification-errors.js'
import { providerRegistry } from './notification-provider.js'
import logger from '../../../lib/logger.js'
import { prisma } from '../../../lib/prisma.js'

// ---------------------------------------------------------------------------
// Optional attachment shape
// ---------------------------------------------------------------------------

export interface EmailAttachment {
  filename: string
  contentBase64: string
}

// ---------------------------------------------------------------------------
// HTML builder — minimal, brand-safe, no external resources
// ---------------------------------------------------------------------------

function buildHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" style="max-width:600px;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="padding-bottom:24px;border-bottom:1px solid #e8ecf0;">
            <span style="font-size:20px;font-weight:700;color:#1a56db;">HisaabPro</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;">
            <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${escapeHtml(title)}</h2>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(body).replace(/\n/g, '<br/>')}</p>
          </td>
        </tr>
        <tr>
          <td style="padding-top:32px;border-top:1px solid #e8ecf0;font-size:12px;color:#9ca3af;">
            This is an automated message from HisaabPro. Do not reply.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

interface ResendError {
  statusCode?: number
  name?: string
  message?: string
}

function classifyResendError(err: ResendError): DispatchResult {
  if (err.statusCode === 422) {
    return {
      success: false,
      costPaise: 0,
      errorCode: NotificationErrorCode.INVALID_RECIPIENT,
      errorMessage: err.message,
      retryable: false,
    }
  }
  if (err.statusCode === 429) {
    return {
      success: false,
      costPaise: 0,
      errorCode: NotificationErrorCode.RATE_LIMITED,
      errorMessage: err.message,
      retryable: true,
    }
  }
  return {
    success: false,
    costPaise: 0,
    errorCode: NotificationErrorCode.PROVIDER_DOWN,
    errorMessage: err.message,
    retryable: true,
  }
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

const resendProvider: NotificationProvider = {
  name: 'EMAIL',

  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
  },

  estimateCostPaise(): number {
    return 30 // ~Rs 0.30 per email
  },

  async send(
    ctx: NotificationContext,
    rendered: RenderedTemplate,
  ): Promise<DispatchResult> {
    // Resolve user email from DB
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true },
    })

    if (!user?.email) {
      return {
        success: false,
        costPaise: 0,
        errorCode: NotificationErrorCode.INVALID_RECIPIENT,
        errorMessage: 'User has no email address on file',
        retryable: false,
      }
    }

    const html = rendered.payload.emailHtml ?? buildHtml(rendered.title, rendered.body)

    const attachments: { filename: string; content: Buffer }[] =
      (ctx.vars['_attachments'] as unknown as EmailAttachment[] | undefined ?? []).map(
        (a) => ({
          filename: a.filename,
          content: Buffer.from(a.contentBase64, 'base64'),
        }),
      )

    try {
      const { Resend } = await import('resend')
      const client = new Resend(process.env.RESEND_API_KEY!)

      const { data, error } = await client.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: [user.email],
        subject: rendered.title,
        html,
        ...(attachments.length > 0 ? { attachments } : {}),
      })

      if (error) {
        logger.warn('resend.send.error', { userId: ctx.userId, error })
        return classifyResendError(error as ResendError)
      }

      logger.info('resend.send.success', { userId: ctx.userId, id: data?.id })

      return {
        success: true,
        externalId: data?.id,
        costPaise: 30,
        retryable: false,
      }
    } catch (err) {
      logger.warn('resend.send.exception', { userId: ctx.userId, err })
      return classifyResendError(err as ResendError)
    }
  },
}

// Register only when configured (fail-closed)
if (resendProvider.isConfigured()) {
  providerRegistry.register('EMAIL', resendProvider)
}

export { resendProvider }
