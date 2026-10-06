import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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
      assert.equal(called, false, 'Fetch must not be called when env vars are unset')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('formats new user onboarding alert without throwing', () => {
    assert.doesNotThrow(() => {
      alertNewUserOnboarded({
        name: 'Ramesh Patel',
        phone: '9876543210',
        businessName: 'Patel Dairy',
        businessId: 'biz_123',
        method: 'OTP',
      })
    })
  })

  it('formats payment captured alert with rupee calculations without throwing', () => {
    assert.doesNotThrow(() => {
      alertPaymentCaptured({
        businessId: 'biz_456',
        planTier: 'PRO',
        razorpaySubId: 'sub_789',
        event: 'subscription.charged',
        amountPaise: 79900,
      })
    })
  })

  it('formats one-time order paid alert without throwing', () => {
    assert.doesNotThrow(() => {
      alertOneTimeOrderPaid({
        paymentId: 'pay_999',
        event: 'payment.captured',
      })
    })
  })

  it('throttles duplicate server error alerts within cooldown window', () => {
    assert.doesNotThrow(() => {
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
    })
  })
})
