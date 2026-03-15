/**
 * Demo Seed Script — Populates the database with realistic Indian business data
 * Run: npx tsx prisma/seed-demo.ts
 *
 * Creates: 10 parties, 8 products, 6 invoices, 4 payments
 * All amounts in PAISE.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BUSINESS_ID = 'biz_dev_001'
const USER_ID = 'cmmrvqlb60001rotw4rzi1004'

async function main() {
  console.log('Seeding demo data...')

  // Get existing unit and category IDs
  const units = await prisma.unit.findMany({
    where: { businessId: BUSINESS_ID },
    select: { id: true, symbol: true },
  })
  const categories = await prisma.category.findMany({
    where: { businessId: BUSINESS_ID },
    select: { id: true, name: true },
  })

  const pcsUnit = units.find(u => u.symbol === 'pcs') ?? units[0]
  const kgUnit = units.find(u => u.symbol === 'kg') ?? units[0]
  const ltrUnit = units.find(u => u.symbol === 'ltr') ?? pcsUnit

  const generalCat = categories.find(c => c.name === 'General') ?? categories[0]
  const electronicsCat = categories.find(c => c.name === 'Electronics') ?? generalCat
  const groceryCat = categories.find(c => c.name === 'Grocery') ?? generalCat
  const hardwareCat = categories.find(c => c.name === 'Hardware') ?? generalCat

  if (!pcsUnit || !generalCat) {
    console.error('No units or categories found. Run the app once to seed defaults.')
    return
  }

  // ── Parties ──────────────────────────────────────────────────────────────

  const parties = await Promise.all([
    upsertParty('Rajesh Electronics', '+919876543001', 'CUSTOMER', 'rajesh@email.com'),
    upsertParty('Sharma General Store', '+919876543002', 'CUSTOMER'),
    upsertParty('Priya Traders', '+919876543003', 'CUSTOMER'),
    upsertParty('Mumbai Wholesale', '+919876543004', 'SUPPLIER'),
    upsertParty('Delhi Parts House', '+919876543005', 'SUPPLIER'),
    upsertParty('Amit Kumar', '+919876543006', 'CUSTOMER'),
    upsertParty('Sunita Devi', '+919876543007', 'CUSTOMER'),
    upsertParty('Patel & Sons', '+919876543008', 'CUSTOMER', 'patel@business.in'),
    upsertParty('National Distributors', '+919876543009', 'SUPPLIER'),
    upsertParty('Gupta Hardware', '+919876543010', 'BOTH'),
  ])

  console.log(`  Created/updated ${parties.length} parties`)

  // ── Products ────────────────────────────────────────────────────────────

  const products = await Promise.all([
    upsertProduct('Wireless Mouse', 'PRD-0010', pcsUnit.id, electronicsCat.id, 49900, 32000, 25, 5),
    upsertProduct('USB-C Cable (1m)', 'PRD-0011', pcsUnit.id, electronicsCat.id, 19900, 9500, 50, 10),
    upsertProduct('LED Bulb 9W', 'PRD-0012', pcsUnit.id, electronicsCat.id, 12000, 6500, 100, 20),
    upsertProduct('Basmati Rice (1kg)', 'PRD-0013', kgUnit.id, groceryCat.id, 18000, 14000, 30, 5),
    upsertProduct('Toor Dal (1kg)', 'PRD-0014', kgUnit.id, groceryCat.id, 16000, 12500, 20, 5),
    upsertProduct('Paint Brush Set', 'PRD-0015', pcsUnit.id, hardwareCat.id, 35000, 18000, 15, 3),
    upsertProduct('Masking Tape Roll', 'PRD-0016', pcsUnit.id, hardwareCat.id, 8000, 4500, 40, 10),
    upsertProduct('Power Strip 4-way', 'PRD-0017', pcsUnit.id, electronicsCat.id, 59900, 35000, 12, 3),
  ])

  console.log(`  Created/updated ${products.length} products`)

  // ── Invoices ────────────────────────────────────────────────────────────

  const today = new Date()
  const daysAgo = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return d
  }

  // Check if invoices already exist
  const existingInvoices = await prisma.document.count({
    where: { businessId: BUSINESS_ID, type: 'SALE_INVOICE' },
  })

  if (existingInvoices === 0) {
    // Invoice 1: Rajesh Electronics — 3 items
    const inv1 = await createInvoice(
      parties[0].id, daysAgo(5), 'SAVED', 'INV-001',
      [
        { productId: products[0].id, qty: 2, rate: 49900, disc: 0 },
        { productId: products[7].id, qty: 1, rate: 59900, disc: 500 },
        { productId: products[1].id, qty: 5, rate: 19900, disc: 0 },
      ]
    )

    // Invoice 2: Sharma General Store — 2 items
    const inv2 = await createInvoice(
      parties[1].id, daysAgo(3), 'SAVED', 'INV-002',
      [
        { productId: products[3].id, qty: 10, rate: 18000, disc: 0 },
        { productId: products[4].id, qty: 5, rate: 16000, disc: 0 },
      ]
    )

    // Invoice 3: Priya Traders — 1 item, large qty
    const inv3 = await createInvoice(
      parties[2].id, daysAgo(1), 'SAVED', 'INV-003',
      [
        { productId: products[2].id, qty: 50, rate: 12000, disc: 1000 },
      ]
    )

    // Invoice 4: Amit Kumar — small order
    const inv4 = await createInvoice(
      parties[5].id, daysAgo(0), 'SAVED', 'INV-004',
      [
        { productId: products[5].id, qty: 1, rate: 35000, disc: 0 },
        { productId: products[6].id, qty: 3, rate: 8000, disc: 0 },
      ]
    )

    // Invoice 5: Patel & Sons — today, DRAFT
    const inv5 = await createInvoice(
      parties[7].id, daysAgo(0), 'DRAFT', null,
      [
        { productId: products[0].id, qty: 5, rate: 49900, disc: 2500 },
      ]
    )

    // Invoice 6: Purchase invoice from Mumbai Wholesale
    const inv6 = await createPurchaseInvoice(
      parties[3].id, daysAgo(7), 'SAVED', 'PUR-001',
      [
        { productId: products[0].id, qty: 30, rate: 32000, disc: 0 },
        { productId: products[1].id, qty: 100, rate: 9500, disc: 0 },
      ]
    )

    console.log(`  Created 6 invoices`)

    // ── Payments ────────────────────────────────────────────────────────────

    // Payment from Rajesh Electronics (partial payment on INV-001 — ~50% of grandTotal)
    const rajeshPartial = Math.round(inv1.grandTotal * 0.5)
    await createPayment(parties[0].id, 'PAYMENT_IN', rajeshPartial, daysAgo(4), 'UPI', 'UPI-REF-001', inv1.id)

    // Payment from Sharma General Store (full payment)
    await createPayment(parties[1].id, 'PAYMENT_IN', inv2.grandTotal, daysAgo(2), 'CASH', null, inv2.id)

    // Payment to Mumbai Wholesale (partial — ~60% of grandTotal)
    const mumbaiPartial = Math.round(inv6.grandTotal * 0.6)
    await createPayment(parties[3].id, 'PAYMENT_OUT', mumbaiPartial, daysAgo(6), 'BANK_TRANSFER', 'NEFT-123456', inv6.id)

    // Payment from Amit Kumar (full, today)
    await createPayment(parties[5].id, 'PAYMENT_IN', inv4.grandTotal, daysAgo(0), 'UPI', 'UPI-REF-002', inv4.id)

    console.log(`  Created 4 payments`)
  } else {
    console.log(`  Skipped invoices/payments (${existingInvoices} invoices already exist)`)
  }

  console.log('Demo seed complete!')
}

// ── Helper functions ───────────────────────────────────────────────────────

async function upsertParty(name: string, phone: string, type: string, email?: string) {
  const existing = await prisma.party.findFirst({
    where: { businessId: BUSINESS_ID, phone },
  })
  if (existing) return existing

  return prisma.party.create({
    data: {
      businessId: BUSINESS_ID,
      name,
      phone,
      type,
      email: email ?? null,
      isActive: true,
    },
  })
}

async function upsertProduct(
  name: string, sku: string, unitId: string, categoryId: string,
  salePrice: number, purchasePrice: number, stock: number, minStock: number
) {
  const existing = await prisma.product.findFirst({
    where: { businessId: BUSINESS_ID, sku },
  })
  if (existing) return existing

  return prisma.product.create({
    data: {
      businessId: BUSINESS_ID,
      name,
      sku,
      unitId,
      categoryId,
      salePrice,
      purchasePrice,
      currentStock: stock,
      minStockLevel: minStock,
      status: 'ACTIVE',
    },
  })
}

async function createInvoice(
  partyId: string,
  date: Date,
  status: string,
  docNumber: string | null,
  items: Array<{ productId: string; qty: number; rate: number; disc: number }>,
) {
  let subtotal = 0
  let totalDiscount = 0

  const lineItemsData = items.map((item, idx) => {
    const lineTotal = item.qty * item.rate - item.disc
    subtotal += item.qty * item.rate
    totalDiscount += item.disc
    return {
      productId: item.productId,
      sortOrder: idx,
      quantity: item.qty,
      rate: item.rate,
      discountType: 'FIXED' as const,
      discountValue: item.disc,
      discountAmount: item.disc,
      lineTotal,
      purchasePrice: 0,
      profit: 0,
      profitPercent: 0,
    }
  })

  const grandTotal = subtotal - totalDiscount

  const doc = await prisma.document.create({
    data: {
      businessId: BUSINESS_ID,
      type: 'SALE_INVOICE',
      status,
      documentNumber: docNumber,
      partyId,
      documentDate: date,
      subtotal,
      totalDiscount,
      grandTotal,
      balanceDue: grandTotal,
      paidAmount: 0,
      createdBy: USER_ID,
      lineItems: { create: lineItemsData },
    },
  })

  // Update party outstanding
  if (status === 'SAVED') {
    await prisma.party.update({
      where: { id: partyId },
      data: {
        outstandingBalance: { increment: grandTotal },
        totalBusiness: { increment: grandTotal },
        lastTransactionAt: date,
      },
    })
  }

  return doc
}

async function createPurchaseInvoice(
  partyId: string,
  date: Date,
  status: string,
  docNumber: string | null,
  items: Array<{ productId: string; qty: number; rate: number; disc: number }>,
) {
  let subtotal = 0
  let totalDiscount = 0

  const lineItemsData = items.map((item, idx) => {
    const lineTotal = item.qty * item.rate - item.disc
    subtotal += item.qty * item.rate
    totalDiscount += item.disc
    return {
      productId: item.productId,
      sortOrder: idx,
      quantity: item.qty,
      rate: item.rate,
      discountType: 'FIXED' as const,
      discountValue: item.disc,
      discountAmount: item.disc,
      lineTotal,
      purchasePrice: item.rate,
      profit: 0,
      profitPercent: 0,
    }
  })

  const grandTotal = subtotal - totalDiscount

  const doc = await prisma.document.create({
    data: {
      businessId: BUSINESS_ID,
      type: 'PURCHASE_INVOICE',
      status,
      documentNumber: docNumber,
      partyId,
      documentDate: date,
      subtotal,
      totalDiscount,
      grandTotal,
      balanceDue: grandTotal,
      paidAmount: 0,
      createdBy: USER_ID,
      lineItems: { create: lineItemsData },
    },
  })

  // Update party outstanding (payable)
  if (status === 'SAVED') {
    await prisma.party.update({
      where: { id: partyId },
      data: {
        outstandingBalance: { decrement: grandTotal },
        totalBusiness: { increment: grandTotal },
        lastTransactionAt: date,
      },
    })
  }

  return doc
}

async function createPayment(
  partyId: string,
  type: string,
  amount: number,
  date: Date,
  mode: string,
  ref: string | null,
  invoiceId: string,
) {
  const payment = await prisma.payment.create({
    data: {
      businessId: BUSINESS_ID,
      type,
      partyId,
      amount,
      date,
      mode,
      referenceNumber: ref,
      createdBy: USER_ID,
    },
  })

  // Create allocation
  await prisma.paymentAllocation.create({
    data: {
      paymentId: payment.id,
      invoiceId,
      amount,
    },
  })

  // Update invoice paid amount
  await prisma.document.update({
    where: { id: invoiceId },
    data: {
      paidAmount: { increment: amount },
      balanceDue: { decrement: amount },
    },
  })

  // Update party outstanding
  if (type === 'PAYMENT_IN') {
    await prisma.party.update({
      where: { id: partyId },
      data: { outstandingBalance: { decrement: amount } },
    })
  } else {
    await prisma.party.update({
      where: { id: partyId },
      data: { outstandingBalance: { increment: amount } },
    })
  }

  return payment
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
