/**
 * Thin API client for E2E setup/assertions — hits the REAL server on 5001.
 *
 * Used for two things only:
 *   1. reading the OTP the app just sent (no other read path exists — see
 *      server/src/lib/test-hooks.ts)
 *   2. arranging preconditions faster than driving the UI would
 *
 * It is never used to *replace* a user action under test. A spec that verifies
 * registration drives the form; it only calls lastOtp() for the code, because
 * a human reads that from an SMS the browser cannot see.
 */

import type { APIRequestContext } from '@playwright/test'

export const API_BASE = 'http://localhost:5001/api'

interface Envelope<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

async function json<T>(res: { json(): Promise<unknown>; status(): number }): Promise<Envelope<T>> {
  return (await res.json()) as Envelope<T>
}

/** Confirms the test hooks are live. Call once in globalSetup-style guards. */
export async function testHooksLive(request: APIRequestContext): Promise<boolean> {
  const res = await request.get(`${API_BASE}/__test__/health`)
  return res.status() === 200
}

/** The plaintext OTP most recently issued to `phone`, or null if none/expired. */
export async function lastOtp(request: APIRequestContext, phone: string): Promise<string | null> {
  const res = await request.get(`${API_BASE}/__test__/last-otp`, { params: { phone } })
  if (res.status() !== 200) return null
  const body = await json<{ otp: string }>(res)
  return body.data?.otp ?? null
}

/**
 * Polls for an OTP. `sendOTP` is awaited inside the register handler, so the
 * code is buffered before the response returns — but the browser's request and
 * this one are separate connections, so a bounded poll beats a fixed sleep.
 */
export async function waitForOtp(
  request: APIRequestContext,
  phone: string,
  timeoutMs = 10_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const otp = await lastOtp(request, phone)
    if (otp) return otp
    if (Date.now() > deadline) throw new Error(`No OTP issued for ${phone} within ${timeoutMs}ms`)
    await new Promise((r) => setTimeout(r, 200))
  }
}

/** Drops the OTP buffer so one spec's codes cannot satisfy another's wait. */
export async function resetOtps(request: APIRequestContext): Promise<void> {
  await request.post(`${API_BASE}/__test__/reset-otps`)
}

/** Registers a verified account without driving the UI — a login precondition. */
export async function registerVerifiedUser(
  request: APIRequestContext,
  phone: string,
  password: string,
  name = 'E2E User',
): Promise<void> {
  const reg = await request.post(`${API_BASE}/auth/register`, { data: { phone, name, password } })
  if (!reg.ok()) {
    throw new Error(`register failed (${reg.status()}): ${await reg.text()}`)
  }
  const otp = await waitForOtp(request, phone)
  // 201 — verify-registration creates the account. Assert 2xx, not a literal.
  const verify = await request.post(`${API_BASE}/auth/verify-registration`, { data: { phone, otp } })
  if (!verify.ok()) {
    throw new Error(`verify-registration failed (${verify.status()}): ${await verify.text()}`)
  }
}
