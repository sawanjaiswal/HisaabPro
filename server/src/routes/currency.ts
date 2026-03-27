/**
 * Currency Routes — Multi-Currency Phase 2E
 *
 * POST /api/currency/exchange-rates         — set/upsert rate
 * GET  /api/currency/exchange-rates         — list rates (paginated)
 * GET  /api/currency/exchange-rates/:code   — latest rate for one currency
 * GET  /api/currency/supported              — static list of supported currencies
 * POST /api/currency/convert                — convert amount between currencies
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  setExchangeRateSchema,
  listExchangeRatesSchema,
  convertAmountSchema,
  getExchangeRateSchema,
} from '../schemas/currency.schemas.js'
import {
  setExchangeRate,
  getExchangeRate,
  listExchangeRates,
  convertAmount,
  getSupportedCurrencies,
} from '../services/currency.service.js'

const router = Router()

router.use(auth)

/** POST /api/currency/exchange-rates — Set or update an exchange rate */
router.post(
  '/exchange-rates',
  requirePermission('settings.modify'),
  validate(setExchangeRateSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const rate = await setExchangeRate(businessId, req.body)
    sendSuccess(res, rate, 201)
  }),
)

/** GET /api/currency/exchange-rates — List rates (paginated, optional ?fromCurrency=) */
router.get(
  '/exchange-rates',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const filters = listExchangeRatesSchema.parse(req.query)
    const result = await listExchangeRates(businessId, filters)
    sendSuccess(res, result)
  }),
)

/** GET /api/currency/exchange-rates/:code — Latest rate for a specific currency */
router.get(
  '/exchange-rates/:code',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const fromCurrency = String(req.params.code).toUpperCase()
    const { date } = getExchangeRateSchema.parse(req.query)
    const rate = await getExchangeRate(businessId, fromCurrency, 'INR', date)
    sendSuccess(res, rate)
  }),
)

/** GET /api/currency/supported — Static list of supported currencies */
router.get(
  '/supported',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, getSupportedCurrencies())
  }),
)

/** POST /api/currency/convert — Convert amount between any two currencies */
router.post(
  '/convert',
  requirePermission('settings.view'),
  validate(convertAmountSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await convertAmount(businessId, req.body)
    sendSuccess(res, result)
  }),
)

export default router
