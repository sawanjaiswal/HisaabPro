/**
 * Anthropic Vision client for receipt OCR.
 * Isolated here so expense-ocr.service.ts stays under 250 LOC.
 * Retry-once on network errors and 429s.
 */

import Anthropic from '@anthropic-ai/sdk'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { getOcrModel } from '../../lib/env.js'

const SYSTEM_PROMPT =
  'You are a receipt parser. Extract data and return STRICT JSON only — no markdown, no prose. ' +
  'Keys: amountPaise (integer paise, 0 if not parseable), vendor (string), ' +
  'date (YYYY-MM-DD or null), category (string hint: food/fuel/office/travel/utilities/other), ' +
  'confidence (0..1 float). No other keys.'

export type AllowedMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface AnthropicReceiptJson {
  amountPaise: number
  vendor: string
  date: string | null
  category: string
  confidence: number
}

async function attempt(
  client: Anthropic,
  base64Image: string,
  mimeType: AllowedMimeType,
): Promise<string> {
  const model = getOcrModel()

  const response = await client.messages.create({
    model,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          { type: 'text', text: 'Parse this receipt and return JSON only.' },
        ],
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new AppError(ErrorCode.INTERNAL_ERROR, 422, 'Unexpected Anthropic response type', {
      code: 'OCR_PARSE_FAILED',
    })
  }
  return block.text
}

export async function callAnthropicOcr(
  client: Anthropic,
  base64Image: string,
  mimeType: AllowedMimeType,
): Promise<string> {
  try {
    return await attempt(client, base64Image, mimeType)
  } catch (err: unknown) {
    const isRetryable =
      err instanceof Anthropic.APIConnectionError ||
      err instanceof Anthropic.RateLimitError

    if (isRetryable) {
      try {
        return await attempt(client, base64Image, mimeType)
      } catch {
        throw new AppError(ErrorCode.DATABASE_ERROR, 503,
          'OCR service temporarily unavailable — please retry',
          { code: 'OCR_UNAVAILABLE' })
      }
    }

    if (err instanceof Anthropic.APIError && err.status >= 500) {
      throw new AppError(ErrorCode.DATABASE_ERROR, 503,
        'OCR service temporarily unavailable — please retry',
        { code: 'OCR_UNAVAILABLE' })
    }

    throw err
  }
}

export function parseAnthropicResponse(raw: string): AnthropicReceiptJson {
  let parsed: unknown
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new AppError(ErrorCode.INTERNAL_ERROR, 422, 'OCR response could not be parsed', {
      code: 'OCR_PARSE_FAILED',
      rawResponse: raw,
    })
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, 422, 'OCR response has unexpected shape', {
      code: 'OCR_PARSE_FAILED',
      rawResponse: raw,
    })
  }

  const obj = parsed as Record<string, unknown>
  return {
    amountPaise: typeof obj.amountPaise === 'number' ? Math.round(obj.amountPaise) : 0,
    vendor:      typeof obj.vendor      === 'string'  ? obj.vendor      : '',
    date:        typeof obj.date        === 'string' && obj.date ? obj.date : null,
    category:    typeof obj.category    === 'string'  ? obj.category    : '',
    confidence:  typeof obj.confidence  === 'number'
      ? Math.min(1, Math.max(0, obj.confidence))
      : 0,
  }
}
