// Play Store closed-testing mock layer.
//
// When the app is built with VITE_OFFLINE_MOCK=1 (or runs in the Capacitor
// Android webview at https://localhost), every api() call is short-circuited
// here instead of hitting the backend. Lets a Play Store reviewer log in with
// any phone+password, Google SSO, see seeded data, create parties/invoices/payments/products,
// and have everything persist across restarts via localStorage.

const DB_KEY = 'hp_offline_mock_db_v5'

// Detect Capacitor native webview (https://localhost) OR explicit env flag.
export const OFFLINE_MOCK: boolean =
  import.meta.env.VITE_OFFLINE_MOCK === '1' ||
  (typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    window.location.hostname === 'localhost')

// ─── DB shape ────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>

interface MockUser {
  id: string
  phone: string
  name: string | null
  email: string | null
}

interface MockBusiness {
  id: string
  name: string
  businessType: string
  role: string
  roleId: string | null
  roleName: string
  status: string
  lastActiveAt: string | null
}

interface MockCategory {
  id: string
  name: string
  color?: string
  sortOrder?: number
}

interface MockUnit {
  id: string
  name: string
  symbol: string
}

interface MockTaxCategory {
  id: string
  name: string
  rate: number
  isDefault: boolean
}

interface MockParty {
  id: string
  name: string
  phone?: string
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  tags: string[]
  outstandingBalance: number
  creditLimit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  email?: string
  companyName?: string
  gstin?: string
  pan?: string
  creditLimitMode: 'WARN' | 'BLOCK'
  totalBusiness: number
  notes?: string
  addresses: unknown[]
  customFields: unknown[]
  pricing: unknown[]
}

interface MockLineItem {
  id: string
  productId: string
  product: { id: string; name: string; unit: string }
  quantity: number
  rate: number
  discountType?: 'PERCENT' | 'FIXED'
  discountValue?: number
  discountAmount: number
  taxCategoryId?: string | null
  taxAmount?: number
  lineTotal: number
}

interface MockDocument {
  id: string
  documentNumber: string
  type: string
  status: string
  party: { id: string; name: string; phone: string }
  documentDate: string
  dueDate: string | null
  subtotal: number
  totalDiscount: number
  totalAdditionalCharges: number
  roundOff: number
  grandTotal: number
  totalProfit: number
  paidAmount: number
  balanceDue: number
  lineItemCount: number
  lineItems: MockLineItem[]
  notes?: string
  paymentTerms?: string
  createdAt: string
  updatedAt: string
}

interface MockProduct {
  id: string
  name: string
  sku: string
  category: { id: string; name: string }
  unit: { id: string; name: string; symbol: string }
  salePrice: number
  purchasePrice: number | null
  currentStock: number
  minStockLevel: number
  status: 'ACTIVE' | 'INACTIVE'
  barcode?: string
  hsnCode?: string
  description?: string
  createdAt: string
  updatedAt?: string
}

interface MockPayment {
  id: string
  partyId: string
  partyName: string
  amount: number
  date: string
  mode: string
  reference: string | null
  type: 'IN' | 'OUT'
  createdAt: string
}

interface OfflineDB {
  user: MockUser | null
  businesses: MockBusiness[]
  categories: MockCategory[]
  units: MockUnit[]
  taxCategories: MockTaxCategory[]
  parties: MockParty[]
  documents: MockDocument[]
  products: MockProduct[]
  payments: MockPayment[]
  settings: {
    pinEnabled: boolean
    biometricEnabled: boolean
    theme: 'light' | 'dark'
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  const rand = crypto.getRandomValues(new Uint8Array(4))
  const suffix = Array.from(rand).map((b) => b.toString(36)).join('').slice(0, 6)
  return `${prefix}_${Date.now().toString(36)}${suffix}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function setAuthCookie(value: boolean): void {
  if (typeof document !== 'undefined') {
    document.cookie = `isAuthenticated=${value}; path=/; max-age=${value ? 60 * 60 * 24 * 365 : 0}`
  }
}

function seed(): OfflineDB {
  const businessId = uid('biz')

  const categories: MockCategory[] = [
    { id: 'cat_general', name: 'General', color: '#026F39', sortOrder: 1 },
    { id: 'cat_grocery', name: 'Grocery', color: '#2563EB', sortOrder: 2 },
    { id: 'cat_dairy', name: 'Dairy & Milk', color: '#F59E0B', sortOrder: 3 },
    { id: 'cat_hardware', name: 'Hardware', color: '#64748B', sortOrder: 4 },
    { id: 'cat_electronics', name: 'Electronics', color: '#8B5CF6', sortOrder: 5 },
  ]

  const units: MockUnit[] = [
    { id: 'unit_pcs', name: 'Pieces', symbol: 'pcs' },
    { id: 'unit_kg', name: 'Kilogram', symbol: 'kg' },
    { id: 'unit_ltr', name: 'Litre', symbol: 'ltr' },
    { id: 'unit_box', name: 'Box', symbol: 'box' },
    { id: 'unit_mtr', name: 'Meter', symbol: 'm' },
  ]

  const taxCategories: MockTaxCategory[] = [
    { id: 'tax_0', name: 'GST 0%', rate: 0, isDefault: false },
    { id: 'tax_5', name: 'GST 5%', rate: 500, isDefault: false },
    { id: 'tax_12', name: 'GST 12%', rate: 1200, isDefault: false },
    { id: 'tax_18', name: 'GST 18%', rate: 1800, isDefault: true },
    { id: 'tax_28', name: 'GST 28%', rate: 2800, isDefault: false },
  ]

  const partyA: MockParty = {
    id: uid('p'),
    name: 'Sharma Traders',
    phone: '9810000001',
    type: 'CUSTOMER',
    tags: ['Retail', 'Wholesale'],
    outstandingBalance: 1500000, // ₹15,000
    creditLimit: 10000000,
    creditLimitMode: 'WARN',
    isActive: true,
    totalBusiness: 4500000,
    addresses: [{ id: uid('addr'), addressLine1: 'Shop 12, Main Market', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', isDefault: true }],
    customFields: [],
    pricing: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const partyB: MockParty = {
    id: uid('p'),
    name: 'Verma Wholesale',
    phone: '9810000002',
    type: 'SUPPLIER',
    tags: ['Distributor'],
    outstandingBalance: -800000, // ₹8,000 payable
    creditLimit: 0,
    creditLimitMode: 'WARN',
    isActive: true,
    totalBusiness: 2200000,
    addresses: [{ id: uid('addr'), addressLine1: 'B-4, Industrial Area', city: 'Delhi', state: 'Delhi', pincode: '110020', isDefault: true }],
    customFields: [],
    pricing: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const product1: MockProduct = {
    id: uid('prod'),
    name: 'Toor Dal 1kg',
    sku: 'DAL-1KG',
    category: { id: 'cat_grocery', name: 'Grocery' },
    unit: { id: 'unit_kg', name: 'Kilogram', symbol: 'kg' },
    salePrice: 18000, // ₹180
    purchasePrice: 14000,
    currentStock: 50,
    minStockLevel: 5,
    status: 'ACTIVE',
    createdAt: nowIso(),
  }

  const product2: MockProduct = {
    id: uid('prod'),
    name: 'Sugar 1kg',
    sku: 'SUG-1KG',
    category: { id: 'cat_grocery', name: 'Grocery' },
    unit: { id: 'unit_kg', name: 'Kilogram', symbol: 'kg' },
    salePrice: 5500, // ₹55
    purchasePrice: 4200,
    currentStock: 3,
    minStockLevel: 10,
    status: 'ACTIVE',
    createdAt: nowIso(),
  }

  const product3: MockProduct = {
    id: uid('prod'),
    name: 'Amul Butter 500g',
    sku: 'BUT-500G',
    category: { id: 'cat_dairy', name: 'Dairy & Milk' },
    unit: { id: 'unit_pcs', name: 'Pieces', symbol: 'pcs' },
    salePrice: 27500, // ₹275
    purchasePrice: 24000,
    currentStock: 25,
    minStockLevel: 5,
    status: 'ACTIVE',
    createdAt: nowIso(),
  }

  const document: MockDocument = {
    id: uid('doc'),
    documentNumber: 'INV-001',
    type: 'SALE_INVOICE',
    status: 'SAVED',
    party: { id: partyA.id, name: partyA.name, phone: partyA.phone ?? '' },
    documentDate: nowIso().slice(0, 10),
    dueDate: null,
    subtotal: 1500000,
    totalDiscount: 0,
    totalAdditionalCharges: 0,
    roundOff: 0,
    grandTotal: 1500000,
    totalProfit: 300000,
    paidAmount: 0,
    balanceDue: 1500000,
    lineItemCount: 1,
    lineItems: [
      {
        id: uid('li'),
        productId: product1.id,
        product: { id: product1.id, name: product1.name, unit: product1.unit.symbol },
        quantity: 50,
        rate: 18000,
        discountAmount: 0,
        lineTotal: 900000,
      },
      {
        id: uid('li'),
        productId: product2.id,
        product: { id: product2.id, name: product2.name, unit: product2.unit.symbol },
        quantity: 100,
        rate: 6000,
        discountAmount: 0,
        lineTotal: 600000,
      },
    ],
    notes: 'Thank you for your business!',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const payment: MockPayment = {
    id: uid('pay'),
    partyId: partyA.id,
    partyName: partyA.name,
    amount: 500000, // ₹5,000
    date: nowIso().slice(0, 10),
    mode: 'CASH',
    reference: 'RCP-001',
    type: 'IN',
    createdAt: nowIso(),
  }

  return {
    user: null,
    businesses: [
      {
        id: businessId,
        name: 'My Business',
        businessType: 'RETAIL',
        role: 'OWNER',
        roleId: null,
        roleName: 'Owner',
        status: 'ACTIVE',
        lastActiveAt: nowIso(),
      },
    ],
    categories,
    units,
    taxCategories,
    parties: [partyA, partyB],
    documents: [document],
    products: [product1, product2, product3],
    payments: [payment],
    settings: {
      pinEnabled: false,
      biometricEnabled: false,
      theme: 'light',
    },
  }
}

function loadDB(): OfflineDB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as OfflineDB
  } catch {
    // Corrupt entry — fall through to fresh seed.
  }
  const fresh = seed()
  saveDB(fresh)
  return fresh
}

function saveDB(db: OfflineDB): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // Quota / private mode — non-critical.
  }
}

function makeUser(phone: string, name?: string | null, email?: string | null): MockUser {
  return {
    id: uid('u'),
    phone,
    name: name ?? 'Demo User',
    email: email ?? (phone.includes('@') ? phone : 'user@hisaabpro.in'),
  }
}

function authPayload(db: OfflineDB, isNewUser: boolean): Json {
  const businessId = db.businesses[0]?.id ?? null
  return {
    isNewUser,
    user: db.user
      ? { ...db.user, businessId, role: 'OWNER' }
      : null,
    businesses: db.businesses,
    activeBusiness: db.businesses[0] ?? null,
    tokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    },
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pathOnly(path: string): string {
  const q = path.indexOf('?')
  return q === -1 ? path : path.slice(0, q)
}

function parseBody(body: BodyInit | null | undefined): Json {
  if (!body) return {}
  if (typeof body !== 'string') return {}
  try {
    return JSON.parse(body) as Json
  } catch {
    return {}
  }
}

function param(path: string, key: string): string | null {
  const q = path.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(path.slice(q + 1)).get(key)
}

// ─── Request handler ─────────────────────────────────────────────────────────

export const UNHANDLED = Symbol('mock-unhandled')

export function handleMockRequest(
  method: string,
  rawPath: string,
  rawBody: BodyInit | null | undefined,
): unknown | typeof UNHANDLED {
  const m = method.toUpperCase()
  const path = pathOnly(rawPath)
  const body = parseBody(rawBody)
  const db = loadDB()

  // ─── Auth surface ──────────────────────────────────────────────────────────
  if (path === '/auth/csrf-token' && m === 'GET') {
    return { csrfToken: 'mock-csrf' }
  }

  if (path === '/auth/warmup' && (m === 'POST' || m === 'GET')) {
    return { ok: true }
  }

  if (path === '/auth/sso/google/start-native' && m === 'POST') {
    return {
      sealedTx: 'mock-tx-sealed',
      nonce: 'mock-nonce',
      clientId: 'mock-client-id.apps.googleusercontent.com',
      handoffKey: 'mock-handoff',
    }
  }

  if ((path === '/auth/sso/google/exchange-native' || path === '/auth/google') && m === 'POST') {
    db.user = makeUser('9810000000', 'Google User', 'google.user@hisaabpro.in')
    saveDB(db)
    setAuthCookie(true)
    return authPayload(db, false)
  }

  if (path === '/auth/register' && m === 'POST') {
    db.user = makeUser(String(body.phone ?? ''), (body.name as string) ?? null)
    saveDB(db)
    return { message: 'OTP sent' }
  }

  if (path === '/auth/verify-registration' && m === 'POST') {
    if (!db.user) db.user = makeUser(String(body.phone ?? ''))
    saveDB(db)
    setAuthCookie(true)
    return authPayload(db, true)
  }

  if (path === '/auth/verify-otp' && m === 'POST') {
    if (!db.user) db.user = makeUser(String(body.phone ?? ''))
    saveDB(db)
    setAuthCookie(true)
    return authPayload(db, false)
  }

  if (path === '/auth/resend-otp' && m === 'POST') {
    return { message: 'OTP resent' }
  }

  if (path === '/auth/login' && m === 'POST') {
    const identifier = String(body.identifier ?? body.phone ?? '9999999999')
    if (!db.user || db.user.phone !== identifier) {
      db.user = makeUser(identifier)
    }
    saveDB(db)
    setAuthCookie(true)
    return authPayload(db, false)
  }

  if (path === '/auth/dev-login' && m === 'POST') {
    const username = String(body.username ?? body.identifier ?? 'demo')
    if (!db.user) db.user = makeUser(username)
    saveDB(db)
    setAuthCookie(true)
    return authPayload(db, false)
  }

  if (path === '/auth/forgot-password' && m === 'POST') {
    return { message: 'OTP sent', otpExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() }
  }

  if (path === '/auth/reset-password' && m === 'POST') {
    if (!db.user) db.user = makeUser(String(body.phone ?? ''))
    saveDB(db)
    setAuthCookie(true)
    return authPayload(db, false)
  }

  if (path === '/auth/me' && m === 'GET') {
    if (!db.user) {
      db.user = makeUser('9999999999', 'Demo User')
      saveDB(db)
      setAuthCookie(true)
    }
    return authPayload(db, false)
  }

  if (path === '/auth/logout' && m === 'POST') {
    setAuthCookie(false)
    return null
  }

  if (path === '/auth/account' && m === 'DELETE') {
    localStorage.removeItem(DB_KEY)
    setAuthCookie(false)
    return { success: true }
  }

  if (path === '/auth/refresh' && m === 'POST') {
    return { tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' } }
  }

  if (path === '/auth/switch-business' && m === 'POST') {
    const businessId = String(body.businessId ?? '')
    const biz = db.businesses.find((b) => b.id === businessId)
    if (biz) {
      // Re-order businesses so target is first
      db.businesses = [biz, ...db.businesses.filter((b) => b.id !== businessId)]
      saveDB(db)
    }
    return authPayload(db, false)
  }

  // ─── Categories ────────────────────────────────────────────────────────────
  if (path === '/categories' && m === 'GET') {
    const search = (param(rawPath, 'search') ?? '').toLowerCase()
    let cats = db.categories
    if (search) cats = cats.filter((c) => c.name.toLowerCase().includes(search))
    return cats
  }

  if (path === '/categories' && m === 'POST') {
    const cat: MockCategory = {
      id: uid('cat'),
      name: String(body.name ?? 'New Category'),
      color: typeof body.color === 'string' ? body.color : '#026F39',
      sortOrder: db.categories.length + 1,
    }
    db.categories.push(cat)
    saveDB(db)
    return cat
  }

  const catMatch = path.match(/^\/categories\/([^/]+)$/)
  if (catMatch) {
    const id = catMatch[1]
    const idx = db.categories.findIndex((c) => c.id === id)
    if (idx !== -1) {
      if (m === 'PUT' || m === 'PATCH') {
        db.categories[idx] = { ...db.categories[idx], ...body }
        saveDB(db)
        return db.categories[idx]
      }
      if (m === 'DELETE') {
        db.categories.splice(idx, 1)
        saveDB(db)
        return null
      }
    }
  }

  // ─── Units ─────────────────────────────────────────────────────────────────
  if (path === '/units' && m === 'GET') {
    const search = (param(rawPath, 'search') ?? '').toLowerCase()
    let units = db.units
    if (search) units = units.filter((u) => u.name.toLowerCase().includes(search) || u.symbol.toLowerCase().includes(search))
    return units
  }

  if (path === '/units' && m === 'POST') {
    const unit: MockUnit = {
      id: uid('unit'),
      name: String(body.name ?? 'Pieces'),
      symbol: String(body.symbol ?? 'pcs'),
    }
    db.units.push(unit)
    saveDB(db)
    return unit
  }

  const unitMatch = path.match(/^\/units\/([^/]+)$/)
  if (unitMatch) {
    const id = unitMatch[1]
    const idx = db.units.findIndex((u) => u.id === id)
    if (idx !== -1) {
      if (m === 'PUT' || m === 'PATCH') {
        db.units[idx] = { ...db.units[idx], ...body }
        saveDB(db)
        return db.units[idx]
      }
      if (m === 'DELETE') {
        db.units.splice(idx, 1)
        saveDB(db)
        return null
      }
    }
  }

  if (path === '/units/conversions' && m === 'GET') {
    return []
  }

  // ─── Tax Categories ────────────────────────────────────────────────────────
  if (path === '/tax-categories' && m === 'GET') {
    return db.taxCategories
  }

  if (path === '/tax-categories/seed-defaults' && m === 'POST') {
    return db.taxCategories
  }

  if (path === '/tax-categories' && m === 'POST') {
    const tc: MockTaxCategory = {
      id: uid('tax'),
      name: String(body.name ?? 'GST Tax'),
      rate: typeof body.rate === 'number' ? body.rate : 1800,
      isDefault: false,
    }
    db.taxCategories.push(tc)
    saveDB(db)
    return tc
  }

  // ─── Parties ───────────────────────────────────────────────────────────────
  if (path === '/parties' && m === 'GET') {
    const search = (param(rawPath, 'search') ?? '').toLowerCase()
    const type = param(rawPath, 'type')
    let parties = db.parties
    if (search) parties = parties.filter((p) => p.name.toLowerCase().includes(search) || (p.phone && p.phone.includes(search)))
    if (type && type !== 'ALL') parties = parties.filter((p) => p.type === type)
    const totalReceivable = parties
      .filter((p) => p.outstandingBalance > 0)
      .reduce((s, p) => s + p.outstandingBalance, 0)
    const totalPayable = parties
      .filter((p) => p.outstandingBalance < 0)
      .reduce((s, p) => s + Math.abs(p.outstandingBalance), 0)
    return {
      parties,
      pagination: { page: 1, limit: parties.length || 20, total: parties.length, totalPages: 1 },
      summary: {
        totalReceivable,
        totalPayable,
        netOutstanding: totalReceivable - totalPayable,
        totalParties: parties.length,
        customersCount: parties.filter((p) => p.type === 'CUSTOMER').length,
        suppliersCount: parties.filter((p) => p.type === 'SUPPLIER').length,
        bothCount: parties.filter((p) => p.type === 'BOTH').length,
      },
    }
  }

  if (path === '/parties' && m === 'POST') {
    const party: MockParty = {
      id: uid('p'),
      name: String(body.name ?? 'New Party'),
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      type: (body.type as MockParty['type']) ?? 'CUSTOMER',
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
      outstandingBalance: typeof body.openingBalance === 'number' ? body.openingBalance : 0,
      creditLimit: typeof body.creditLimit === 'number' ? body.creditLimit : 0,
      creditLimitMode: (body.creditLimitMode as MockParty['creditLimitMode']) ?? 'WARN',
      isActive: true,
      totalBusiness: 0,
      email: typeof body.email === 'string' ? body.email : undefined,
      companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
      gstin: typeof body.gstin === 'string' ? body.gstin : undefined,
      pan: typeof body.pan === 'string' ? body.pan : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      addresses: Array.isArray(body.addresses) ? (body.addresses as unknown[]) : [],
      customFields: [],
      pricing: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    db.parties.unshift(party)
    saveDB(db)
    return { party }
  }

  const partyDetailMatch = path.match(/^\/parties\/([^/]+)$/)
  if (partyDetailMatch) {
    const id = partyDetailMatch[1]
    const idx = db.parties.findIndex((p) => p.id === id)
    if (idx === -1) return { party: null }
    if (m === 'GET') return { party: db.parties[idx] }
    if (m === 'PUT' || m === 'PATCH') {
      db.parties[idx] = { ...db.parties[idx], ...body, updatedAt: nowIso() } as MockParty
      saveDB(db)
      return { party: db.parties[idx] }
    }
    if (m === 'DELETE') {
      db.parties.splice(idx, 1)
      saveDB(db)
      return null
    }
  }

  if (path.match(/^\/parties\/[^/]+\/transactions$/) && m === 'GET') {
    return {
      transactions: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      summary: { totalDebit: 0, totalCredit: 0, closingBalance: 0 },
    }
  }

  // ─── Products ──────────────────────────────────────────────────────────────
  if (path === '/products' && m === 'GET') {
    const lowStockOnly = param(rawPath, 'lowStockOnly') === 'true'
    const search = (param(rawPath, 'search') ?? '').toLowerCase()
    const categoryId = param(rawPath, 'categoryId')

    const isLowStock = (p: MockProduct) => p.minStockLevel > 0 && p.currentStock <= p.minStockLevel

    let products = db.products
    if (search) products = products.filter((p) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search))
    if (categoryId) products = products.filter((p) => p.category.id === categoryId)
    if (lowStockOnly) products = products.filter(isLowStock)

    const totalStockValue = db.products.reduce((s, p) => s + p.currentStock * (p.purchasePrice ?? 0), 0)
    const lowStockCount = db.products.filter(isLowStock).length

    return {
      products,
      pagination: { page: 1, limit: products.length || 20, total: products.length, totalPages: 1 },
      summary: {
        totalProducts: db.products.length,
        lowStockCount,
        totalStockValue,
      },
    }
  }

  if (path === '/products' && m === 'POST') {
    const cat = db.categories.find((c) => c.id === body.categoryId) ?? db.categories[0] ?? { id: 'cat_general', name: 'General' }
    const un = db.units.find((u) => u.id === body.unitId) ?? db.units[0] ?? { id: 'unit_pcs', name: 'Pieces', symbol: 'pcs' }
    const product: MockProduct = {
      id: uid('prod'),
      name: String(body.name ?? 'New Product'),
      sku: typeof body.sku === 'string' && body.sku.trim() ? body.sku : `SKU-${db.products.length + 1}`,
      category: { id: cat.id, name: cat.name },
      unit: { id: un.id, name: un.name, symbol: un.symbol },
      salePrice: typeof body.salePrice === 'number'
        ? body.salePrice
        : typeof body.sellingPrice === 'number' ? body.sellingPrice : 0,
      purchasePrice: typeof body.purchasePrice === 'number' ? body.purchasePrice : null,
      currentStock: typeof body.openingStock === 'number'
        ? body.openingStock
        : typeof body.currentStock === 'number' ? body.currentStock : 0,
      minStockLevel: typeof body.minStockLevel === 'number' ? body.minStockLevel : 0,
      status: 'ACTIVE',
      createdAt: nowIso(),
    }
    db.products.unshift(product)
    saveDB(db)
    return { product }
  }

  const productAnalyticsMatch = path.match(/^\/products\/([^/]+)\/analytics$/)
  if (productAnalyticsMatch && m === 'GET') {
    const id = productAnalyticsMatch[1]
    const p = db.products.find((prod) => prod.id === id)
    return {
      stockStats: {
        current: p?.currentStock ?? 0,
        available: p?.currentStock ?? 0,
        reserved: 0,
        minStock: p?.minStockLevel ?? 0,
      },
      salesStats: {
        totalSold: 12,
        totalRevenue: (p?.salePrice ?? 0) * 12,
      },
    }
  }

  const productDetailMatch = path.match(/^\/products\/([^/]+)$/)
  if (productDetailMatch) {
    const id = productDetailMatch[1]
    const idx = db.products.findIndex((p) => p.id === id)
    if (idx === -1) return { product: null }
    if (m === 'GET') {
      const prod = db.products[idx]
      return {
        product: {
          ...prod,
          recentMovements: [
            { id: uid('sm'), type: 'OPENING', quantity: prod.currentStock, date: prod.createdAt, notes: 'Opening stock' },
          ],
        },
      }
    }
    if (m === 'PUT' || m === 'PATCH') {
      const cat = db.categories.find((c) => c.id === body.categoryId) ?? db.products[idx].category
      const un = db.units.find((u) => u.id === body.unitId) ?? db.products[idx].unit
      db.products[idx] = {
        ...db.products[idx],
        ...body,
        category: cat ? { id: cat.id, name: cat.name } : db.products[idx].category,
        unit: un ? { id: un.id, name: un.name, symbol: un.symbol } : db.products[idx].unit,
        updatedAt: nowIso(),
      } as MockProduct
      saveDB(db)
      return { product: db.products[idx] }
    }
    if (m === 'DELETE') {
      db.products.splice(idx, 1)
      saveDB(db)
      return { success: true }
    }
  }

  if (path === '/products/adjust-stock' && m === 'POST') {
    const prodId = String(body.productId ?? '')
    const prod = db.products.find((p) => p.id === prodId)
    if (prod && typeof body.adjustedQuantity === 'number') {
      prod.currentStock = body.adjustedQuantity
      saveDB(db)
    }
    return { success: true }
  }

  // ─── Documents (invoices) ──────────────────────────────────────────────────
  if (path === '/documents' && m === 'GET') {
    const type = param(rawPath, 'type')
    const partyId = param(rawPath, 'partyId')
    let documents = db.documents
    if (type) documents = documents.filter((d) => d.type === type)
    if (partyId) documents = documents.filter((d) => d.party.id === partyId)
    const totalAmount = documents.reduce((s, d) => s + d.grandTotal, 0)
    const totalPaid = documents.reduce((s, d) => s + d.paidAmount, 0)
    return {
      documents,
      pagination: { page: 1, limit: documents.length || 20, total: documents.length, totalPages: 1 },
      summary: { totalAmount, totalPaid, totalDue: totalAmount - totalPaid },
    }
  }

  if (path === '/documents' && m === 'POST') {
    const partyId = String(body.partyId ?? db.parties[0]?.id ?? '')
    const party = db.parties.find((p) => p.id === partyId)
    const grandTotal = typeof body.grandTotal === 'number' ? body.grandTotal : 0
    const rawItems = Array.isArray(body.lineItems) ? body.lineItems : []

    const lineItems: MockLineItem[] = rawItems.map((item: any) => {
      const prod = db.products.find((p) => p.id === item.productId)
      return {
        id: uid('li'),
        productId: item.productId,
        product: {
          id: item.productId,
          name: prod?.name ?? 'Item',
          unit: prod?.unit?.symbol ?? 'pcs',
        },
        quantity: item.quantity ?? 1,
        rate: item.rate ?? 0,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount ?? 0,
        taxCategoryId: item.taxCategoryId,
        taxAmount: item.taxAmount ?? 0,
        lineTotal: item.lineTotal ?? (item.quantity ?? 1) * (item.rate ?? 0),
      }
    })

    const type = String(body.type ?? 'SALE_INVOICE')
    const docCount = db.documents.filter((d) => d.type === type).length + 1
    const numberPrefix = type === 'SALE_INVOICE' ? 'INV' : type === 'PURCHASE_INVOICE' ? 'PUR' : 'DOC'
    const doc: MockDocument = {
      id: uid('doc'),
      documentNumber: `${numberPrefix}-${String(docCount).padStart(3, '0')}`,
      type,
      status: String(body.status ?? 'SAVED'),
      party: { id: partyId, name: party?.name ?? 'Unknown', phone: party?.phone ?? '' },
      documentDate: typeof body.documentDate === 'string'
        ? body.documentDate
        : typeof body.issueDate === 'string' ? body.issueDate : nowIso().slice(0, 10),
      dueDate: typeof body.dueDate === 'string' ? body.dueDate : null,
      subtotal: typeof body.subtotal === 'number' ? body.subtotal : grandTotal,
      totalDiscount: typeof body.totalDiscount === 'number' ? body.totalDiscount : 0,
      totalAdditionalCharges: typeof body.totalAdditionalCharges === 'number' ? body.totalAdditionalCharges : 0,
      roundOff: typeof body.roundOff === 'number' ? body.roundOff : 0,
      grandTotal,
      totalProfit: typeof body.totalProfit === 'number' ? body.totalProfit : 0,
      paidAmount: 0,
      balanceDue: grandTotal,
      lineItemCount: lineItems.length,
      lineItems,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      paymentTerms: typeof body.paymentTerms === 'string' ? body.paymentTerms : 'COD',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    db.documents.unshift(doc)
    if (party && type === 'SALE_INVOICE') {
      party.outstandingBalance += grandTotal
      party.totalBusiness += grandTotal
    }
    saveDB(db)
    return doc
  }

  const docDetailMatch = path.match(/^\/documents\/([^/]+)$/)
  if (docDetailMatch) {
    const id = docDetailMatch[1]
    const idx = db.documents.findIndex((d) => d.id === id)
    if (m === 'GET') return idx === -1 ? null : db.documents[idx]
    if ((m === 'PUT' || m === 'PATCH') && idx !== -1) {
      db.documents[idx] = { ...db.documents[idx], ...body, updatedAt: nowIso() } as MockDocument
      saveDB(db)
      return db.documents[idx]
    }
    if (m === 'DELETE' && idx !== -1) {
      db.documents.splice(idx, 1)
      saveDB(db)
      return { id, status: 'DELETED', deletedAt: nowIso(), permanentDeleteAt: nowIso() }
    }
  }

  if (path === '/documents/validate-stock' && m === 'POST') {
    return { valid: true, warnings: [], blockers: [] }
  }

  if (path.startsWith('/settings/documents/number-series/') && m === 'GET') {
    return { nextNumber: 'INV-002', prefix: 'INV', financialYear: '2025-26', sequence: 2 }
  }

  if (path.startsWith('/sales/documents/') && path.endsWith('/lineage') && m === 'GET') {
    return { steps: [] }
  }

  // ─── Payments & Outstanding ────────────────────────────────────────────────
  if (path.startsWith('/payments/outstanding/list') && m === 'GET') {
    const typeFilter = param(rawPath, 'type')
    const overdueOnly = param(rawPath, 'overdue') === 'true'
    const search = (param(rawPath, 'search') ?? '').toLowerCase()

    const partiesWithBalance = db.parties.filter((p) => p.outstandingBalance !== 0)
    const mapped = partiesWithBalance.map((p) => {
      const isReceivable = p.outstandingBalance > 0
      return {
        partyId: p.id,
        partyName: p.name,
        partyPhone: p.phone ?? '',
        partyType: p.type,
        outstanding: Math.abs(p.outstandingBalance),
        type: (isReceivable ? 'RECEIVABLE' : 'PAYABLE') as 'RECEIVABLE' | 'PAYABLE',
        invoiceCount: db.documents.filter((d) => d.party.id === p.id && d.balanceDue > 0).length || 1,
        oldestDueDate: null,
        daysOverdue: 0,
        lastPaymentDate: null,
        lastReminderDate: null,
        aging: { current: Math.abs(p.outstandingBalance), days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 },
      }
    })

    const filtered = mapped.filter((row) => {
      if (typeFilter === 'RECEIVABLE' && row.type !== 'RECEIVABLE') return false
      if (typeFilter === 'PAYABLE' && row.type !== 'PAYABLE') return false
      if (overdueOnly && row.daysOverdue <= 0) return false
      if (search && !row.partyName.toLowerCase().includes(search)) return false
      return true
    })

    const totalReceivable = mapped.filter((r) => r.type === 'RECEIVABLE').reduce((s, r) => s + r.outstanding, 0)
    const totalPayable = mapped.filter((r) => r.type === 'PAYABLE').reduce((s, r) => s + r.outstanding, 0)

    return {
      parties: filtered,
      pagination: { page: 1, limit: filtered.length || 20, total: filtered.length, totalPages: 1 },
      totals: {
        totalReceivable,
        totalPayable,
        net: totalReceivable - totalPayable,
        overdueReceivable: 0,
        overduePayable: 0,
      },
      aging: {
        current: totalReceivable + totalPayable,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
      },
    }
  }

  if (path === '/payments' && m === 'GET') {
    return {
      payments: db.payments,
      pagination: { page: 1, limit: db.payments.length || 20, total: db.payments.length, totalPages: 1 },
    }
  }

  if (path === '/payments' && m === 'POST') {
    const partyId = String(body.partyId ?? '')
    const party = db.parties.find((p) => p.id === partyId)
    const payment: MockPayment = {
      id: uid('pay'),
      partyId,
      partyName: party?.name ?? 'Unknown',
      amount: typeof body.amount === 'number' ? body.amount : 0,
      date: typeof body.date === 'string' ? body.date : nowIso().slice(0, 10),
      mode: typeof body.mode === 'string' ? body.mode : 'CASH',
      reference: typeof body.reference === 'string' ? body.reference : null,
      type: (body.type as 'IN' | 'OUT') ?? 'IN',
      createdAt: nowIso(),
    }
    db.payments.unshift(payment)
    if (party) {
      party.outstandingBalance -= payment.type === 'IN' ? payment.amount : -payment.amount
    }
    saveDB(db)
    return { payment }
  }

  const paymentDetailMatch = path.match(/^\/payments\/([^/]+)$/)
  if (paymentDetailMatch) {
    const id = paymentDetailMatch[1]
    const idx = db.payments.findIndex((p) => p.id === id)
    if (idx === -1) return { payment: null }
    if (m === 'GET') return { payment: db.payments[idx] }
    if (m === 'PUT' || m === 'PATCH') {
      db.payments[idx] = { ...db.payments[idx], ...body } as MockPayment
      saveDB(db)
      return { payment: db.payments[idx] }
    }
    if (m === 'DELETE') {
      db.payments.splice(idx, 1)
      saveDB(db)
      return { success: true }
    }
  }

  if (path === '/payments/reminders/send-bulk' && m === 'POST') {
    const partyIds = Array.isArray(body.partyIds) ? (body.partyIds as string[]) : []
    const results = partyIds.map((pid) => {
      const party = db.parties.find((p) => p.id === pid)
      const hasPhone = !!party?.phone && party.phone.trim() !== ''
      return {
        partyId: pid,
        partyName: party?.name ?? 'Unknown',
        status: hasPhone ? ('SENT' as const) : ('FAILED' as const),
        failureReason: hasPhone ? null : 'No phone number on file',
      }
    })
    return {
      sent: results.filter((r) => r.status === 'SENT').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    }
  }

  if (path === '/payments/reminders/send' && m === 'POST') {
    return {
      id: uid('rem'),
      partyId: String(body.partyId ?? ''),
      channel: body.channel ?? 'WHATSAPP',
      status: 'SENT',
      sentAt: nowIso(),
    }
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  if (path === '/dashboard/home' && m === 'GET') {
    const receivable = db.parties
      .filter((p) => p.outstandingBalance > 0)
      .reduce((s, p) => s + p.outstandingBalance, 0)
    const payable = db.parties
      .filter((p) => p.outstandingBalance < 0)
      .reduce((s, p) => s + Math.abs(p.outstandingBalance), 0)
    const recentActivity = db.documents.slice(0, 5).map((d) => ({
      id: d.id,
      type: d.type === 'SALE_INVOICE' ? 'sale_invoice' : 'purchase_invoice',
      partyId: d.party.id,
      partyName: d.party.name,
      amount: d.grandTotal,
      date: d.documentDate,
      reference: d.documentNumber,
      status: d.balanceDue === 0 ? 'paid' : d.paidAmount > 0 ? 'partial' : 'unpaid',
    }))
    const today = nowIso().slice(0, 10)
    const todaysSales = db.documents.filter((d) => d.documentDate === today && d.type === 'SALE_INVOICE')
    const totalSalesAmount = db.documents.filter((d) => d.type === 'SALE_INVOICE').reduce((s, d) => s + d.grandTotal, 0)
    const collectionsTotal = db.payments.reduce((s, p) => s + p.amount, 0)
    const trend = {
      days: 30,
      sales: {
        total: totalSalesAmount,
        previousTotal: Math.round(totalSalesAmount * 0.85),
        deltaPct: 15,
        series: [
          Math.round(totalSalesAmount * 0.1),
          Math.round(totalSalesAmount * 0.2),
          Math.round(totalSalesAmount * 0.25),
          Math.round(totalSalesAmount * 0.45),
        ],
      },
      collections: {
        total: collectionsTotal,
        previousTotal: Math.round(collectionsTotal * 0.9),
        deltaPct: 10,
        series: [
          Math.round(collectionsTotal * 0.1),
          Math.round(collectionsTotal * 0.2),
          Math.round(collectionsTotal * 0.3),
          Math.round(collectionsTotal * 0.4),
        ],
      },
      expenses: {
        total: 125000,
        previousTotal: 150000,
        deltaPct: -16,
        series: [20000, 30000, 35000, 40000],
      },
      cashInHand: collectionsTotal > 0 ? collectionsTotal : 500000,
      todayVsYesterday: {
        today: todaysSales.reduce((s, d) => s + d.grandTotal, 0),
        yesterday: Math.round(totalSalesAmount * 0.2),
        deltaPct: 12,
      },
    }
    return {
      outstanding: {
        receivable: { total: receivable, partyCount: db.parties.filter((p) => p.outstandingBalance > 0).length },
        payable: { total: payable, partyCount: db.parties.filter((p) => p.outstandingBalance < 0).length },
      },
      today: {
        salesCount: todaysSales.length,
        salesAmount: todaysSales.reduce((s, d) => s + d.grandTotal, 0),
        paymentsReceivedCount: db.payments.length,
        paymentsReceivedAmount: db.payments.reduce((s, p) => s + p.amount, 0),
        paymentsMadeAmount: 0,
        netCashFlow: db.payments.reduce((s, p) => s + p.amount, 0),
      },
      recentActivity,
      trend,
      alerts: {
        lowStockCount: db.products.filter((p) => p.minStockLevel > 0 && p.currentStock <= p.minStockLevel).length,
        overdueInvoiceCount: 0,
        overdueAmount: 0,
      },
      topDebtors: db.parties
        .filter((p) => p.outstandingBalance > 0)
        .slice(0, 5)
        .map((p) => ({
          partyId: p.id,
          name: p.name,
          phone: p.phone ?? '',
          outstanding: p.outstandingBalance,
          oldestDueDate: p.createdAt,
          daysOverdue: 0,
        })),
    }
  }

  if (path.startsWith('/dashboard/activity/search') && m === 'GET') {
    return []
  }

  if (path.startsWith('/dashboard/stats') && m === 'GET') {
    return {
      range: { from: nowIso().slice(0, 10), to: nowIso().slice(0, 10), label: 'Today' },
      sales: { count: db.documents.length, amount: db.documents.reduce((s, d) => s + d.grandTotal, 0) },
      purchases: { count: 0, amount: 0 },
      receivable: { total: 1500000, partyCount: 1 },
      payable: { total: 800000, partyCount: 1 },
      topOutstandingCustomers: [],
      paymentsReceived: 500000,
      paymentsMade: 0,
      netCashFlow: 500000,
    }
  }

  // ─── Reports ───────────────────────────────────────────────────────────────
  if (path.startsWith('/reports/day-book') && m === 'GET') {
    return {
      entries: db.documents.map((d) => ({
        id: d.id,
        date: d.documentDate,
        type: 'SALE',
        reference: d.documentNumber,
        partyName: d.party.name,
        amount: d.grandTotal,
      })),
      summary: {
        totalSales: db.documents.reduce((s, d) => s + d.grandTotal, 0),
        totalReceipts: db.payments.reduce((s, p) => s + p.amount, 0),
        totalPayments: 0,
        netCash: db.payments.reduce((s, p) => s + p.amount, 0),
      },
    }
  }

  if (path.startsWith('/reports/stock-summary') && m === 'GET') {
    return {
      products: db.products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        unit: p.unit.symbol,
        currentStock: p.currentStock,
        minStockLevel: p.minStockLevel,
        purchasePrice: p.purchasePrice ?? 0,
        salePrice: p.salePrice,
        stockValue: p.currentStock * (p.purchasePrice ?? 0),
      })),
      totals: {
        totalItems: db.products.length,
        totalQuantity: db.products.reduce((s, p) => s + p.currentStock, 0),
        totalValue: db.products.reduce((s, p) => s + p.currentStock * (p.purchasePrice ?? 0), 0),
      },
    }
  }

  if (path.startsWith('/reports/tax-summary') && m === 'GET') {
    return {
      salesTax: 0,
      purchaseTax: 0,
      netTax: 0,
      taxBreakdown: [],
    }
  }

  // ─── Business & Settings ───────────────────────────────────────────────────
  if ((path.startsWith('/businesses/') || path === '/businesses/current') && m === 'GET') {
    return {
      ...db.businesses[0],
      upiVpa: 'hisaabpro@upi',
      phone: '9810000000',
      email: 'business@hisaabpro.in',
      address: 'Shop 1, Commercial Complex, Jaipur',
      gstin: '08AAAAA0000A1Z5',
    }
  }

  if (path === '/settings/app' && m === 'GET') {
    return db.settings
  }

  if (path === '/settings/app' && (m === 'PUT' || m === 'PATCH')) {
    db.settings = { ...db.settings, ...body }
    saveDB(db)
    return db.settings
  }

  if (path === '/health' && m === 'GET') return { ok: true }

  return UNHANDLED
}

export function defaultMockResponse(method: string): unknown {
  return method.toUpperCase() === 'GET' ? [] : {}
}
