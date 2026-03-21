const API_BASE = process.env.API_URL || 'http://localhost:3000/api'

// Safety: prevent accidental execution against production
if (API_BASE.includes('production') || API_BASE.includes('hisaabpro.in')) {
  throw new Error(
    `SAFETY: data-factory.ts cannot run against production API (${API_BASE}). ` +
    'Set API_URL to localhost or a staging domain.',
  )
}

// ─── Auth (scoped per-call, not module-level) ────────────────────────────────

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  token?: string,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }
  const response = await fetch(`${API_BASE}${url}`, { ...options, headers })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      `API ${options.method || 'GET'} ${url} failed: ${response.status} — ${JSON.stringify(data)}`,
    )
  }

  return { status: response.status, data }
}

export async function loginTestUser(): Promise<string> {
  // Request OTP
  await authenticatedFetch('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: '9876543210' }),
  })
  // Verify with test OTP (dev mode accepts 123456)
  const result = await authenticatedFetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: '9876543210', otp: '123456' }),
  })
  const token = result.data?.data?.token
  if (!token) {
    throw new Error('loginTestUser failed: no token in response')
  }
  return token
}

// ─── Products ────────────────────────────────────────────────────────────────
export async function createTestProduct(token: string, overrides: Record<string, unknown> = {}) {
  const product = {
    name: `Test Product ${Date.now()}`,
    sku: `TP-${Date.now()}`,
    salePrice: 15000, // ₹150.00 in paise
    purchasePrice: 10000,
    unit: 'PCS',
    trackStock: true,
    openingStock: 100,
    lowStockAlert: 10,
    ...overrides,
  }
  const result = await authenticatedFetch('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  }, token)
  return result.data?.data
}

// ─── Godowns ─────────────────────────────────────────────────────────────────
export async function createTestGodown(token: string, overrides: Record<string, unknown> = {}) {
  const godown = {
    name: `Test Godown ${Date.now()}`,
    address: '123 Test Street, Mumbai',
    isDefault: false,
    ...overrides,
  }
  const result = await authenticatedFetch('/godowns', {
    method: 'POST',
    body: JSON.stringify(godown),
  }, token)
  return result.data?.data
}

// ─── Batches ─────────────────────────────────────────────────────────────────
export async function createTestBatch(token: string, productId: string, overrides: Record<string, unknown> = {}) {
  const batch = {
    productId,
    batchNumber: `BATCH-${Date.now()}`,
    manufacturingDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    costPrice: 10000,
    salePrice: 15000,
    quantity: 50,
    ...overrides,
  }
  const result = await authenticatedFetch('/batches', {
    method: 'POST',
    body: JSON.stringify(batch),
  }, token)
  return result.data?.data
}

// ─── Serial Numbers ──────────────────────────────────────────────────────────
export async function createTestSerial(token: string, productId: string, overrides: Record<string, unknown> = {}) {
  const serial = {
    productId,
    serialNumber: `SN-${Date.now()}`,
    status: 'AVAILABLE',
    ...overrides,
  }
  const result = await authenticatedFetch('/serial-numbers', {
    method: 'POST',
    body: JSON.stringify(serial),
  }, token)
  return result.data?.data
}

// ─── Stock Verification ──────────────────────────────────────────────────────
export async function createTestVerification(token: string, overrides: Record<string, unknown> = {}) {
  const verification = {
    name: `Stock Count ${Date.now()}`,
    type: 'FULL',
    ...overrides,
  }
  const result = await authenticatedFetch('/stock-verification', {
    method: 'POST',
    body: JSON.stringify(verification),
  }, token)
  return result.data?.data
}

// ─── Seed All Phase 4 Data ───────────────────────────────────────────────────
export async function seedPhase4Data() {
  const token = await loginTestUser()

  // Create 5 products (use timestamp-based SKUs to avoid unique constraint violations)
  const ts = Date.now()
  const products = await Promise.all([
    createTestProduct(token, { name: 'Tata Salt 1kg', sku: `SALT-${ts}-1`, salePrice: 2800 }),
    createTestProduct(token, { name: 'Amul Butter 500g', sku: `BTR-${ts}-1`, salePrice: 28000 }),
    createTestProduct(token, { name: 'Samsung Galaxy A15', sku: `SAM-${ts}-1`, salePrice: 1399900, trackStock: true }),
    createTestProduct(token, { name: 'Parle-G Biscuit', sku: `PLG-${ts}-1`, salePrice: 1000 }),
    createTestProduct(token, { name: 'Notebook A4 100pg', sku: `NB-${ts}-1`, salePrice: 5000 }),
  ])

  // Validate all products created before proceeding
  const validProducts = products.filter(Boolean)
  if (validProducts.length !== 5) {
    throw new Error(`seedPhase4Data: only ${validProducts.length}/5 products created`)
  }

  // Create 2 godowns
  const godowns = await Promise.all([
    createTestGodown(token, { name: 'Main Warehouse', address: 'Industrial Area, Pune', isDefault: true }),
    createTestGodown(token, { name: 'Shop Floor', address: 'MG Road, Pune' }),
  ])

  // Create 3 batches (depends on products)
  const batches = await Promise.all([
    createTestBatch(token, products[0].id, { batchNumber: `SALT-${ts}-A`, quantity: 200 }),
    createTestBatch(token, products[0].id, { batchNumber: `SALT-${ts}-B`, quantity: 150 }),
    createTestBatch(token, products[1].id, { batchNumber: `BTR-${ts}-A`, quantity: 50 }),
  ])

  // Create 5 serials for Samsung phone (depends on products)
  const serials = await Promise.all([
    createTestSerial(token, products[2].id, { serialNumber: `IMEI-${ts}-1` }),
    createTestSerial(token, products[2].id, { serialNumber: `IMEI-${ts}-2` }),
    createTestSerial(token, products[2].id, { serialNumber: `IMEI-${ts}-3` }),
    createTestSerial(token, products[2].id, { serialNumber: `IMEI-${ts}-4` }),
    createTestSerial(token, products[2].id, { serialNumber: `IMEI-${ts}-5` }),
  ])

  // Create 1 verification
  const verification = await createTestVerification(token, { name: `Monthly Count ${ts}` })

  return { products, godowns, batches, serials, verification, token }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
export async function cleanupTestData(token: string) {
  // Note: /test/cleanup endpoint must exist and be guarded with NODE_ENV !== 'production'
  // If it doesn't exist yet, this will throw (by design — implement the endpoint first)
  await authenticatedFetch('/test/cleanup', { method: 'POST' }, token)
}
