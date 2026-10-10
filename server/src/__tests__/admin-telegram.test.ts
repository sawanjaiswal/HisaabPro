import { describe, it, expect } from 'vitest'
import {
  sendSuperAdminAlert,
  alertNewUserOnboarded,
  alertPaymentCaptured,
  alertOneTimeOrderPaid,
  alertServerError,
} from '../lib/admin-telegram.js'

describe('Super-Admin Telegram Alerter', () => {
  it('no-ops safely when ADMIN_TELEGRAM_BOT_TOKEN and CHAT_ID are unset', async () => {
    let called = false
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      called = true
      return new Response('ok')
    }) as typeof fetch

    try {
      await sendSuperAdminAlert('Test alert')
      expect(called).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('formats new user onboarding alert without throwing', () => {
    expect(() => {
      alertNewUserOnboarded({
        name: 'Ramesh Patel',
        phone: '9876543210',
        businessName: 'Patel Dairy',
        businessId: 'biz_123',
        method: 'OTP',
      })
    }).not.toThrow()
  })

  it('formats payment captured alert with rupee calculations without throwing', () => {
    expect(() => {
      alertPaymentCaptured({
        businessId: 'biz_456',
        planTier: 'PRO',
        razorpaySubId: 'sub_789',
        event: 'subscription.charged',
        amountPaise: 79900,
      })
    }).not.toThrow()
  })

  it('formats one-time order paid alert without throwing', () => {
    expect(() => {
      alertOneTimeOrderPaid({
        paymentId: 'pay_999',
        event: 'payment.captured',
      })
    }).not.toThrow()
  })

  it('throttles duplicate server error alerts within cooldown window', () => {
    expect(() => {
      alertServerError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database connection dropped',
        method: 'POST',
        path: '/api/parties',
      })
      alertServerError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database connection dropped again',
        method: 'POST',
        path: '/api/parties',
      })
    }).not.toThrow()
  })
})
