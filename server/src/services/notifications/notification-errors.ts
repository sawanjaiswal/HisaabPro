/**
 * Notification Engine — Typed Error Codes (PR2)
 * Pure constants + error classes — no Prisma, no runtime dependencies.
 */

/** Exhaustive list of notification-pipeline error codes. */
export const NotificationErrorCode = {
  /** Phone / email / FCM token did not pass validation. Non-retryable. */
  INVALID_RECIPIENT: 'INVALID_RECIPIENT',
  /** External provider is unavailable (HTTP 5xx / timeout). Retryable. */
  PROVIDER_DOWN: 'PROVIDER_DOWN',
  /** FCM token has been invalidated (token-not-registered). Non-retryable. */
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  /** Per-user per-day external notification cap reached (10/day). Non-retryable. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Monthly cost budget exhausted for the business. Non-retryable. */
  COST_CAP_EXCEEDED: 'COST_CAP_EXCEEDED',
  /**
   * WhatsApp templates not registered with Aisensy.
   * Thrown by WhatsAppProvider.send(). Non-retryable.
   */
  NOT_REGISTERED: 'NOT_REGISTERED',
  /** User has opted out of this channel/event combination. Non-retryable. */
  OPTED_OUT: 'OPTED_OUT',
  /** Notification deferred due to quiet hours — not an error, used for logging. */
  QUIET_HOURS_DEFERRED: 'QUIET_HOURS_DEFERRED',
} as const

export type NotificationErrorCode =
  (typeof NotificationErrorCode)[keyof typeof NotificationErrorCode]

/** Base class for all notification-pipeline errors. */
export class NotificationError extends Error {
  readonly code: NotificationErrorCode
  readonly retryable: boolean

  constructor(
    code: NotificationErrorCode,
    message: string,
    retryable: boolean,
  ) {
    super(message)
    this.name = 'NotificationError'
    this.code = code
    this.retryable = retryable
  }
}

/** Thrown when a recipient identifier fails validation. */
export class InvalidRecipientError extends NotificationError {
  constructor(message: string) {
    super(NotificationErrorCode.INVALID_RECIPIENT, message, false)
    this.name = 'InvalidRecipientError'
  }
}

/** Thrown when an external provider returns a 5xx or times out. */
export class ProviderDownError extends NotificationError {
  constructor(message: string) {
    super(NotificationErrorCode.PROVIDER_DOWN, message, true)
    this.name = 'ProviderDownError'
  }
}

/** Thrown when an FCM token is no longer registered. */
export class ExpiredTokenError extends NotificationError {
  constructor(message: string) {
    super(NotificationErrorCode.EXPIRED_TOKEN, message, false)
    this.name = 'ExpiredTokenError'
  }
}

/** Thrown when the per-user daily external-notification cap is reached. */
export class RateLimitedError extends NotificationError {
  constructor(message: string) {
    super(NotificationErrorCode.RATE_LIMITED, message, false)
    this.name = 'RateLimitedError'
  }
}

/** Thrown when the business monthly cost cap is exceeded. */
export class CostCapExceededError extends NotificationError {
  constructor(message: string) {
    super(NotificationErrorCode.COST_CAP_EXCEEDED, message, false)
    this.name = 'CostCapExceededError'
  }
}

/**
 * Thrown by WhatsAppProvider.send() — templates not registered with Aisensy.
 * Dispatch service guards on registry.isEnabled('WHATSAPP') so this
 * should never be reached in normal flow.
 */
export class NotRegisteredError extends NotificationError {
  constructor(message: string) {
    super(NotificationErrorCode.NOT_REGISTERED, message, false)
    this.name = 'NotRegisteredError'
  }
}
