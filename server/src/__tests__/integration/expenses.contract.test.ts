/**
 * Expense Routes — Contract Tests (REAL DB)
 * Validates expense CRUD, category seeding, and auth guards.
 */
import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { generateToken, authRequest, anonRequest } from './auth-helper.js'
import { seedFullSetup } from './factories.js'

const app = createApp()

async function setupWithCategory() {
  const { user, business } = await seedFullSetup()
  const token = generateToken(user.id, user.phone, business.id)
  const seedRes = await authRequest(app, token).post('/api/expenses/categories/seed')
  return { user, business, token, categoryId: seedRes.body.data[0].id }
}

const expense = (categoryId: string) => ({
  categoryId, amount: 150000, date: '2026-04-01', paymentMode: 'CASH', notes: 'Office rent',
})

// ─── Categories ────────────────────────────────────────────────────────────

describe('POST /api/expenses/categories/seed', () => {
  it('seeds default categories (idempotent)', async () => {
    const { user, business } = await seedFullSetup()
    const token = generateToken(user.id, user.phone, business.id)

    const res = await authRequest(app, token).post('/api/expenses/categories/seed')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(10)
    expect(res.body.data[0]).toHaveProperty('isSystem', true)

    // Idempotent — second call same count
    const res2 = await authRequest(app, token).post('/api/expenses/categories/seed')
    expect(res2.body.data.length).toBe(res.body.data.length)
  })
})

describe('GET /api/expenses/categories', () => {
  it('lists seeded categories with expense counts', async () => {
    const { token } = await setupWithCategory()
    const res = await authRequest(app, token).get('/api/expenses/categories')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(10)
    expect(res.body.data[0]).toHaveProperty('_count')
  })
})

// ─── Create Expense ────────────────────────────────────────────────────────

describe('POST /api/expenses', () => {
  it('creates an expense and persists to DB', async () => {
    const { business, token, categoryId } = await setupWithCategory()
    const res = await authRequest(app, token)
      .post('/api/expenses').send(expense(categoryId))

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.amount).toBe(150000)
    expect(res.body.data.paymentMode).toBe('CASH')
    expect(res.body.data.category.id).toBe(categoryId)

    const db = await prisma.expense.findFirst({ where: { businessId: business.id } })
    expect(db).toBeTruthy()
    expect(db!.amount).toBe(150000)
  })

  it('returns 401 without auth token', async () => {
    const res = await anonRequest(app)
      .post('/api/expenses')
      .send({ categoryId: 'x', amount: 100, date: '2026-01-01', paymentMode: 'CASH' })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})

// ─── List Expenses ─────────────────────────────────────────────────────────

describe('GET /api/expenses', () => {
  it('lists expenses with pagination', async () => {
    const { token, categoryId } = await setupWithCategory()
    await authRequest(app, token).post('/api/expenses').send(expense(categoryId))
    await authRequest(app, token).post('/api/expenses')
      .send({ ...expense(categoryId), amount: 50000, paymentMode: 'UPI' })

    const res = await authRequest(app, token).get('/api/expenses?page=1&limit=10')
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(2)
    expect(res.body.data.pagination.total).toBe(2)
    expect(res.body.data.pagination.page).toBe(1)
  })
})

// ─── Get by ID ─────────────────────────────────────────────────────────────

describe('GET /api/expenses/:id', () => {
  it('returns a single expense with category', async () => {
    const { token, categoryId } = await setupWithCategory()
    const created = await authRequest(app, token)
      .post('/api/expenses').send(expense(categoryId))
    const id = created.body.data.id

    const res = await authRequest(app, token).get(`/api/expenses/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(id)
    expect(res.body.data.category).toHaveProperty('name')
  })
})

// ─── Delete ────────────────────────────────────────────────────────────────

describe('DELETE /api/expenses/:id', () => {
  it('soft-deletes an expense and verifies DB', async () => {
    const { token, categoryId } = await setupWithCategory()
    const created = await authRequest(app, token)
      .post('/api/expenses').send(expense(categoryId))
    const id = created.body.data.id

    const res = await authRequest(app, token).delete(`/api/expenses/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)

    // Use findFirst with explicit isDeleted to bypass soft-delete filter
    const db = await prisma.expense.findFirst({ where: { id, isDeleted: true } })
    expect(db).toBeTruthy()
    expect(db!.deletedAt).toBeTruthy()
  })
})
