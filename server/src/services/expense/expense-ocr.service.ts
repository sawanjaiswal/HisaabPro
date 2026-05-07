/**
 * Expense OCR Service — receipt parsing via Anthropic Vision API.
 *
 * NO image bytes are persisted anywhere.
 * Logs: timestamp, businessId, sourceHash, success/failure, latency_ms only.
 * Anthropic client + parser: expense-ocr.client.ts
 * Route wiring: PR5 (expense-ocr.ts route)
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { getAnthropicApiKey, getOcrMaxBytes } from '../../lib/env.js'
import {
  callAnthropicOcr,
  parseAnthropicResponse,
  type AllowedMimeType,
} from './expense-ocr.client.js'

// ── Constants ─────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

// ── Public types ──────────────────────────────────────────────────────────

export interface ParseReceiptInput {
  businessId: string
  base64Image: string
  mimeType: string
  /** SHA-256 hex of raw image bytes — computed by the route handler in PR5 */
  sourceHash: string
}

export interface ParseReceiptResult {
  amountPaise: number
  vendor: string
  date: string | null          // YYYY-MM-DD
  suggestedCategoryId: string | null
  confidence: number
}

// ── Validation ────────────────────────────────────────────────────────────

function validateInput(input: ParseReceiptInput): void {
  const { base64Image, mimeType } = input

  if (!base64Image || base64Image.trim() === '') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Image is required', {
      code: 'IMAGE_REQUIRED',
    })
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Image must be JPEG, PNG, or WebP', {
      code: 'INVALID_IMAGE_TYPE',
      allowed: [...ALLOWED_MIME_TYPES],
      received: mimeType,
    })
  }

  const padding = (base64Image.match(/={1,2}$/) ?? [''])[0].length
  const approxBytes = Math.floor((base64Image.length * 3) / 4) - padding
  const maxBytes = getOcrMaxBytes()

  if (approxBytes > maxBytes) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Image exceeds 5 MB size limit', {
      code: 'IMAGE_TOO_LARGE',
      approxBytes,
      maxBytes,
    })
  }
}

// ── Idempotency ───────────────────────────────────────────────────────────

async function checkDuplicateReceipt(businessId: string, sourceHash: string): Promise<void> {
  const existing = await prisma.expense.findFirst({
    where: {
      businessId,
      ocrSourceHash: sourceHash,
      isDeleted: false,
      status: 'CONFIRMED',
    },
    select: { id: true },
  })

  if (existing) {
    throw new AppError(
      ErrorCode.DUPLICATE_ENTRY,
      409,
      'A confirmed expense already exists for this receipt',
      { code: 'OCR_DUPLICATE_RECEIPT', expenseId: existing.id },
    )
  }
}

// ── Category resolution ───────────────────────────────────────────────────

async function resolveCategoryId(
  businessId: string,
  hint: string,
): Promise<string | null> {
  if (!hint) return null

  const normalized = hint.toLowerCase().trim()
  const categories = await prisma.expenseCategory.findMany({
    where: { businessId, isDeleted: false },
    select: { id: true, name: true },
  })

  return categories.find(c => c.name.toLowerCase().includes(normalized))?.id ?? null
}

// ── Main export ───────────────────────────────────────────────────────────

export async function parseReceipt(input: ParseReceiptInput): Promise<ParseReceiptResult> {
  const startMs = Date.now()
  const { businessId, base64Image, mimeType, sourceHash } = input

  validateInput(input)
  await checkDuplicateReceipt(businessId, sourceHash)

  const apiKey = getAnthropicApiKey()
  if (!apiKey) {
    logger.warn('OCR_KEY_MISSING', { businessId, sourceHash })
    throw new AppError(ErrorCode.INTERNAL_ERROR, 503, 'OCR service is not configured', {
      code: 'OCR_UNAVAILABLE',
    })
  }

  const client = new Anthropic({ apiKey })

  try {
    const rawText = await callAnthropicOcr(client, base64Image, mimeType as AllowedMimeType)
    const json    = parseAnthropicResponse(rawText)
    const suggestedCategoryId = await resolveCategoryId(businessId, json.category)

    const latencyMs = Date.now() - startMs
    logger.info('OCR_SUCCESS', { businessId, sourceHash, latencyMs, confidence: json.confidence })

    return {
      amountPaise: json.amountPaise,
      vendor:      json.vendor,
      date:        json.date,
      suggestedCategoryId,
      confidence:  json.confidence,
    }
  } catch (err) {
    const latencyMs = Date.now() - startMs
    const code = err instanceof AppError ? err.details?.code : 'UNKNOWN'
    logger.error('OCR_FAILED', { businessId, sourceHash, latencyMs, code })
    throw err
  }
}
