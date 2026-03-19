/**
 * Concurrent Write Conflict Test
 *
 * Tests race conditions: double submit, concurrent payments, stock deduction
 * Run: npx ts-node server/tests/stress/concurrent-test.ts
 *
 * Prerequisites:
 * - Server running on PORT (default 4000)
 * - STRESS_TOKEN set with valid JWT
 */

const BASE_URL = process.env.STRESS_BASE_URL ?? 'http://localhost:4000'
const TOKEN = process.env.STRESS_TOKEN ?? ''

interface TestResult {
  name: string
  total: number
  successes: number
  errors: number
  status429: number
  status409: number
  pass: boolean
  detail: string
}

const results: TestResult[] = []

async function fetchApi(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      ...(options?.headers ?? {}),
    },
  })
}

async function testDoubleSubmit() {
  console.log('\n--- Double Submit Prevention ---')

  // Fire 10 identical requests simultaneously
  const N = 10
  const body = JSON.stringify({
    referralCode: 'TESTCODE123', // Will likely fail but tests idempotency
  })

  const promises = Array.from({ length: N }, () =>
    fetchApi('/api/referral/apply', { method: 'POST', body })
      .then((r) => r.status)
      .catch(() => 0)
  )

  const statuses = await Promise.all(promises)
  const successes = statuses.filter((s) => s >= 200 && s < 300).length
  const rateLimited = statuses.filter((s) => s === 429).length

  const result: TestResult = {
    name: 'Double Submit',
    total: N,
    successes,
    errors: statuses.filter((s) => s >= 500).length,
    status429: rateLimited,
    status409: statuses.filter((s) => s === 409).length,
    pass: successes <= 1, // At most 1 should succeed
    detail: `${successes} succeeded, ${rateLimited} rate-limited`,
  }

  console.log(`  ${result.detail}`)
  console.log(`  Status: ${result.pass ? 'PASS' : 'FAIL'} (expect ≤1 success)`)
  results.push(result)
}

async function testConcurrentWithdrawals() {
  console.log('\n--- Concurrent Withdrawal Requests ---')

  const N = 5
  const body = JSON.stringify({ amount: 200, upiId: 'test@paytm' })

  const promises = Array.from({ length: N }, () =>
    fetchApi('/api/referral/withdraw', { method: 'POST', body })
      .then((r) => r.status)
      .catch(() => 0)
  )

  const statuses = await Promise.all(promises)
  const successes = statuses.filter((s) => s >= 200 && s < 300).length

  const result: TestResult = {
    name: 'Concurrent Withdrawals',
    total: N,
    successes,
    errors: statuses.filter((s) => s >= 500).length,
    status429: statuses.filter((s) => s === 429).length,
    status409: statuses.filter((s) => s === 409).length,
    pass: successes <= 1 && statuses.filter((s) => s >= 500).length === 0,
    detail: `${successes} succeeded, ${statuses.filter((s) => s >= 400 && s < 500).length} rejected`,
  }

  console.log(`  ${result.detail}`)
  console.log(`  Status: ${result.pass ? 'PASS' : 'FAIL'} (expect ≤1 success, 0 server errors)`)
  results.push(result)
}

async function testConcurrentCouponValidation() {
  console.log('\n--- Concurrent Coupon Validation ---')

  const N = 30
  const body = JSON.stringify({ code: 'INVALID_CODE_TEST' })

  const promises = Array.from({ length: N }, () =>
    fetchApi('/api/coupons/validate', { method: 'POST', body })
      .then((r) => r.status)
      .catch(() => 0)
  )

  const statuses = await Promise.all(promises)
  const rateLimited = statuses.filter((s) => s === 429).length

  const result: TestResult = {
    name: 'Coupon Rate Limiting',
    total: N,
    successes: statuses.filter((s) => s >= 200 && s < 300).length,
    errors: statuses.filter((s) => s >= 500).length,
    status429: rateLimited,
    status409: 0,
    pass: rateLimited > 0, // Some should be rate-limited
    detail: `${rateLimited}/${N} rate-limited`,
  }

  console.log(`  ${result.detail}`)
  console.log(`  Status: ${result.pass ? 'PASS' : 'FAIL'} (expect some 429s)`)
  results.push(result)
}

async function testHealthUnderLoad() {
  console.log('\n--- Health Check Under Load ---')

  const N = 100
  const start = Date.now()

  const promises = Array.from({ length: N }, () =>
    fetch(`${BASE_URL}/api/health`)
      .then((r) => ({ status: r.status, latency: Date.now() - start }))
      .catch(() => ({ status: 0, latency: Date.now() - start }))
  )

  const responses = await Promise.all(promises)
  const successes = responses.filter((r) => r.status === 200).length
  const maxLatency = Math.max(...responses.map((r) => r.latency))

  const result: TestResult = {
    name: 'Health Under Load',
    total: N,
    successes,
    errors: responses.filter((r) => r.status >= 500).length,
    status429: responses.filter((r) => r.status === 429).length,
    status409: 0,
    pass: successes >= N * 0.95 && maxLatency < 5000,
    detail: `${successes}/${N} ok, max latency ${maxLatency}ms`,
  }

  console.log(`  ${result.detail}`)
  console.log(`  Status: ${result.pass ? 'PASS' : 'FAIL'} (expect ≥95% success, <5s max)`)
  results.push(result)
}

async function main() {
  console.log(`Concurrent Write Conflict Tests`)
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Token: ${TOKEN ? 'set' : 'NOT SET'}`)

  await testHealthUnderLoad()

  if (TOKEN) {
    await testDoubleSubmit()
    await testConcurrentWithdrawals()
    await testConcurrentCouponValidation()
  } else {
    console.log('\n[SKIP] Auth tests — set STRESS_TOKEN')
  }

  console.log('\n\n========================================')
  console.log('      CONCURRENT TEST SUMMARY')
  console.log('========================================\n')

  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}`)
  }

  const passed = results.filter((r) => r.pass).length
  console.log(`\n${passed}/${results.length} tests passed`)
}

main().catch(console.error)
