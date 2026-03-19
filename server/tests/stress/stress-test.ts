/**
 * Stress Test Suite for HisaabPro API
 *
 * Uses autocannon for HTTP load testing.
 * Run: npx ts-node server/tests/stress/stress-test.ts
 *
 * Prerequisites:
 * - Server running on PORT (default 4000)
 * - Valid JWT token (set STRESS_TOKEN env var or test with /api/health)
 *
 * Thresholds (from PERFORMANCE_RULES):
 * - API response: < 200ms (p95)
 * - DB query: < 100ms
 */

import autocannon from 'autocannon'

const BASE_URL = process.env.STRESS_BASE_URL ?? 'http://localhost:4000'
const TOKEN = process.env.STRESS_TOKEN ?? ''
const DURATION = parseInt(process.env.STRESS_DURATION ?? '10', 10) // seconds
const CONNECTIONS = parseInt(process.env.STRESS_CONNECTIONS ?? '50', 10)

interface TestResult {
  name: string
  requests: number
  throughput: number // req/sec
  latencyP50: number
  latencyP95: number
  latencyP99: number
  errors: number
  timeouts: number
  pass: boolean
}

const results: TestResult[] = []

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' }
  if (TOKEN) h.authorization = `Bearer ${TOKEN}`
  return h
}

async function runTest(name: string, opts: autocannon.Options): Promise<TestResult> {
  console.log(`\n--- ${name} ---`)

  const result = await autocannon({
    ...opts,
    duration: DURATION,
    connections: CONNECTIONS,
  })

  const r: TestResult = {
    name,
    requests: result.requests.total,
    throughput: Math.round(result.requests.average),
    latencyP50: result.latency.p50,
    latencyP95: result.latency.p95,
    latencyP99: result.latency.p99,
    errors: result.errors,
    timeouts: result.timeouts,
    pass: result.latency.p95 < 200 && result.errors === 0,
  }

  console.log(`  Requests: ${r.requests} (${r.throughput}/sec)`)
  console.log(`  Latency:  p50=${r.latencyP50}ms  p95=${r.latencyP95}ms  p99=${r.latencyP99}ms`)
  console.log(`  Errors:   ${r.errors}  Timeouts: ${r.timeouts}`)
  console.log(`  Status:   ${r.pass ? 'PASS' : 'FAIL'}`)

  results.push(r)
  return r
}

async function main() {
  console.log(`\nStress Test Suite — HisaabPro API`)
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Duration: ${DURATION}s per test`)
  console.log(`Connections: ${CONNECTIONS} concurrent`)
  console.log(`Token: ${TOKEN ? 'set' : 'NOT SET (auth tests will fail)'}`)

  // 1. Health check (baseline — no auth, no DB)
  await runTest('Health Check (baseline)', {
    url: `${BASE_URL}/api/health`,
    method: 'GET',
  })

  // 2. Auth: CSRF token endpoint (no auth, light)
  await runTest('CSRF Token', {
    url: `${BASE_URL}/api/auth/csrf-token`,
    method: 'GET',
  })

  if (!TOKEN) {
    console.log('\n[SKIP] Authenticated tests — set STRESS_TOKEN env var')
    printSummary()
    return
  }

  // 3. Auth: /me endpoint (auth + DB read)
  await runTest('GET /me (auth + DB)', {
    url: `${BASE_URL}/api/auth/me`,
    method: 'GET',
    headers: headers(),
  })

  // 4. Products list (paginated, indexed query)
  await runTest('GET /products (paginated)', {
    url: `${BASE_URL}/api/products?page=1&limit=20`,
    method: 'GET',
    headers: headers(),
  })

  // 5. Parties list (paginated, with type counts)
  await runTest('GET /parties (paginated)', {
    url: `${BASE_URL}/api/parties?page=1&limit=20`,
    method: 'GET',
    headers: headers(),
  })

  // 6. Documents list (paginated)
  await runTest('GET /documents (paginated)', {
    url: `${BASE_URL}/api/documents?page=1&limit=20`,
    method: 'GET',
    headers: headers(),
  })

  // 7. Payments list (paginated)
  await runTest('GET /payments (paginated)', {
    url: `${BASE_URL}/api/payments?page=1&limit=20`,
    method: 'GET',
    headers: headers(),
  })

  // 8. Dashboard (aggregate queries)
  await runTest('GET /dashboard (aggregates)', {
    url: `${BASE_URL}/api/dashboard`,
    method: 'GET',
    headers: headers(),
  })

  // 9. Reports: Day book (date-filtered, paginated)
  const today = new Date().toISOString().slice(0, 10)
  await runTest('GET /reports/day-book', {
    url: `${BASE_URL}/api/reports/day-book?from=${today}&to=${today}&limit=50`,
    method: 'GET',
    headers: headers(),
  })

  // 10. Rate limiter burst test (should get 429s)
  console.log('\n--- Rate Limiter Burst Test ---')
  const burstResult = await autocannon({
    url: `${BASE_URL}/api/auth/csrf-token`,
    method: 'GET',
    duration: 5,
    connections: 200,
    amount: 2000,
  })
  const status429 = Object.entries(burstResult.statusCodeStats)
    .find(([code]) => code === '429')
  console.log(`  429 responses: ${status429 ? status429[1].count : 0}`)
  console.log(`  Rate limiter ${status429 ? 'WORKING' : 'NOT TRIGGERED (check config)'}`)

  printSummary()
}

function printSummary() {
  console.log('\n\n========================================')
  console.log('         STRESS TEST SUMMARY')
  console.log('========================================\n')

  const maxName = Math.max(...results.map((r) => r.name.length))

  console.log(
    'Test'.padEnd(maxName + 2) +
    'Req/s'.padStart(8) +
    'p50ms'.padStart(8) +
    'p95ms'.padStart(8) +
    'p99ms'.padStart(8) +
    'Errors'.padStart(8) +
    'Status'.padStart(8)
  )
  console.log('-'.repeat(maxName + 50))

  for (const r of results) {
    console.log(
      r.name.padEnd(maxName + 2) +
      String(r.throughput).padStart(8) +
      String(r.latencyP50).padStart(8) +
      String(r.latencyP95).padStart(8) +
      String(r.latencyP99).padStart(8) +
      String(r.errors).padStart(8) +
      (r.pass ? '  PASS' : '  FAIL').padStart(8)
    )
  }

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length

  console.log(`\nTotal: ${results.length} tests | ${passed} passed | ${failed} failed`)
  console.log(`Threshold: p95 < 200ms, 0 errors\n`)

  if (failed > 0) {
    console.log('FAILED tests need investigation:')
    for (const r of results.filter((r) => !r.pass)) {
      const reasons: string[] = []
      if (r.latencyP95 >= 200) reasons.push(`p95=${r.latencyP95}ms (>200ms)`)
      if (r.errors > 0) reasons.push(`${r.errors} errors`)
      console.log(`  - ${r.name}: ${reasons.join(', ')}`)
    }
  }
}

main().catch(console.error)
