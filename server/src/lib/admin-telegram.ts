/**
 * Super-Admin Telegram Alerter — DudhHisaab operational notifications.
 *
 * Sends alerts to Sawan's personal Telegram chat for:
 *   - New user onboarded
 *   - Subscription payment captured
 *   - Server 5xx errors (throttled)
 *
 * Fail-silent: never throws, never blocks the main request path.
 * Config: ADMIN_TELEGRAM_BOT_TOKEN + ADMIN_TELEGRAM_CHAT_ID env vars.
 * When either var is absent, all calls are no-ops (safe locally).
 */

let logger: { warn: (...args: any[]) => void } = console
try {
  const mod = await import('./logger.js')
  if (mod.default) logger = mod.default
} catch {
  // console fallback
}

function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_CHAT_ID
  const apiUrl = botToken ? `https://api.telegram.org/bot${botToken}/sendMessage` : null
  return { botToken, chatId, apiUrl }
}

// ─── Core send ────────────────────────────────────────────────────────────────

export async function sendSuperAdminAlert(text: string): Promise<void> {
  const { chatId, apiUrl } = getTelegramConfig()
  if (!apiUrl || !chatId) {
    // Silent no-op when env vars absent (local dev, CI)
    return
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.warn('admin_telegram.api_error', { status: res.status, body: body.slice(0, 200) })
    }
  } catch (err) {
    // Fail-silent — never crash the calling code path
    logger.warn('admin_telegram.fetch_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── IST timestamp helper ─────────────────────────────────────────────────────

function istNow(): string {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) // ssot-allow: format paise/number money for display
}

// ─── Formatted alert builders ─────────────────────────────────────────────────

export function alertNewUserOnboarded(params: {
  name?: string | null
  phone: string
  businessName: string
  businessId: string
  method: 'OTP' | 'PASSWORD' | 'SSO'
}): void {
  const displayName = params.name || 'Anonymous'
  void sendSuperAdminAlert(
    `🆕 <b>NEW USER ONBOARDED</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Owner:</b> ${displayName} (${params.phone})\n` +
    `🏪 <b>Business:</b> ${params.businessName}\n` +
    `🆔 <b>Biz ID:</b> <code>${params.businessId}</code>\n` +
    `🔑 <b>Method:</b> ${params.method}\n` +
    `📅 <b>At:</b> ${istNow()}`
  )
}

export function alertPaymentCaptured(params: {
  businessId: string
  planTier: string
  razorpaySubId: string
  event: string
  amountPaise?: number
}): void {
  const rupees = params.amountPaise != null
    ? `₹${(params.amountPaise / 100).toLocaleString('en-IN')}` // ssot-allow: format paise/number money for display
    : 'N/A'

  void sendSuperAdminAlert(
    `💰 <b>PAYMENT CAPTURED</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🏪 <b>Biz ID:</b> <code>${params.businessId}</code>\n` +
    `📦 <b>Plan:</b> ${params.planTier}\n` +
    `💵 <b>Amount:</b> ${rupees}\n` +
    `🔁 <b>Event:</b> ${params.event}\n` +
    `🪙 <b>Sub ID:</b> <code>${params.razorpaySubId}</code>\n` +
    `📅 <b>At:</b> ${istNow()}`
  )
}

export function alertOneTimeOrderPaid(params: {
  paymentId: string
  event: string
}): void {
  void sendSuperAdminAlert(
    `💳 <b>ORDER PAID</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>Payment ID:</b> <code>${params.paymentId}</code>\n` +
    `🔁 <b>Event:</b> ${params.event}\n` +
    `📅 <b>At:</b> ${istNow()}`
  )
}

// ─── Error alerter with per-code throttle ─────────────────────────────────────

const _errorCooldown = new Map<string, number>()
const ERROR_THROTTLE_MS = 60_000 // max 1 alert per error code per 60s

export function alertServerError(params: {
  code: string
  message: string
  method: string
  path: string
}): void {
  const last = _errorCooldown.get(params.code) ?? 0
  if (Date.now() - last < ERROR_THROTTLE_MS) return
  _errorCooldown.set(params.code, Date.now())

  void sendSuperAdminAlert(
    `🚨 <b>SERVER ERROR</b>\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Route:</b> ${params.method} ${params.path}\n` +
    `❌ <b>Error:</b> ${params.message.slice(0, 200)}\n` +
    `🔑 <b>Code:</b> <code>${params.code}</code>\n` +
    `📅 <b>At:</b> ${istNow()}`
  )
}
