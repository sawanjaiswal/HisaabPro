/**
 * Notification Engine — Domain Types (PR2)
 * Pure type/interface module — no Prisma calls, no runtime dependencies.
 */

import type { NotificationChannel } from '@prisma/client'

// Re-export Prisma enum so callers import from one place.
export type { NotificationChannel }

/**
 * String-union alias (mirrors NotificationChannel Prisma enum).
 * Used in places where Prisma import is not available (e.g. pure-type files).
 */
export type ChannelType = NotificationChannel

/** Result returned by every provider's send() call. */
export interface DispatchResult {
  success: boolean
  /** Provider-assigned message/delivery ID (undefined when offline or on immediate failure). */
  externalId?: string
  /** Actual cost charged, in paise (0 for free channels). */
  costPaise: number
  /** Typed error code — matches NotificationErrorCode. */
  errorCode?: string
  /** Human-readable error detail (not surfaced to end-users). */
  errorMessage?: string
  /** Whether a retry is worthwhile (false for hard errors like INVALID_RECIPIENT). */
  retryable: boolean
}

/** Rendered output from the template engine, ready to be passed to a provider. */
export interface RenderedTemplate {
  /** Notification title — ≤ 160 chars. */
  title: string
  /** Notification body — ≤ 1000 chars (SMS callers truncate separately to 160). */
  body: string
  /** Optional deep-link URL, https only. */
  deepLinkUrl?: string
  /** Channel-specific extras. */
  payload: {
    /** Key→value data payload for FCM (data message). */
    fcmData?: Record<string, string>
    /** HTML body for email channels. */
    emailHtml?: string
    /** MSG91 DLT-registered template ID for this event. */
    smsDltTemplateId?: string
  }
}

/**
 * Contextual data passed to the notification dispatch pipeline.
 * Contains everything needed to render templates and resolve recipients.
 */
export interface NotificationContext {
  businessId: string
  userId: string
  /**
   * Notification event key — e.g. 'INVOICE_CREATED', 'PAYMENT_RECEIVED'.
   * Required by the in-app provider to persist the Notification row and by
   * the dispatch pipeline for deduplication and preference lookups.
   */
  eventKey: string
  /** User locale — drives template language. Defaults to 'en'. */
  locale: 'en' | 'hi'
  /**
   * Template substitution variables. Values are strings or numbers;
   * callers must format paise→rupee BEFORE adding to vars.
   */
  vars: Record<string, string | number>
  /** Optional entity the notification is about (e.g. invoice, payment). */
  entityType?: string
  entityId?: string
}

/**
 * Request shape for admin broadcast dispatch.
 * Server resolves the recipient list by tier — no userIds[] from client.
 */
export interface BroadcastReq {
  /** Must be 'ADMIN_BROADCAST'. */
  templateKey: 'ADMIN_BROADCAST'
  /** Substitution variables for the broadcast template. */
  vars: Record<string, string | number>
  /** Target channels for the broadcast. */
  channels: ChannelType[]
  /** Subscription tier to target — server resolves actual users. */
  audience: {
    tier: 'free' | 'pro' | 'business'
  }
}
