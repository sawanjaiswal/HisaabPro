/**
 * Auth helpers for integration tests — JWT generation + supertest wrappers.
 */

import jwt from 'jsonwebtoken'
import request from 'supertest'
import type { Express } from 'express'

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long'

/** Generate a valid access token for integration test requests */
export function generateToken(
  userId: string,
  phone: string,
  businessId: string
) {
  return jwt.sign(
    { userId, phone, businessId, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  )
}

/** Create authenticated supertest helpers pre-set with Bearer token */
export function authRequest(app: Express, token: string) {
  return {
    get: (url: string) =>
      request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) =>
      request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) =>
      request(app).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) =>
      request(app).delete(url).set('Authorization', `Bearer ${token}`),
  }
}

/** Create unauthenticated supertest helpers */
export function anonRequest(app: Express) {
  return {
    get: (url: string) => request(app).get(url),
    post: (url: string) => request(app).post(url),
    put: (url: string) => request(app).put(url),
    delete: (url: string) => request(app).delete(url),
  }
}
