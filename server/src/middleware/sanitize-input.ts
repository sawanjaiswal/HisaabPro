/**
 * Global input sanitization middleware.
 * Escapes HTML entities in all string values of POST/PUT/PATCH request bodies
 * to prevent stored XSS. Preserves Unicode (Hindi, emojis, ₹).
 *
 * Applied BEFORE routes, AFTER body parsing.
 * Skips non-object bodies (raw strings, buffers) and specific fields
 * that legitimately contain HTML (e.g., template content).
 */

import type { Request, Response, NextFunction } from 'express'
import { sanitizeText } from '../lib/sanitize.js'

// Fields that may legitimately contain HTML/rich content — skip sanitization
const SKIP_FIELDS = new Set([
  'templateHtml',
  'customCss',
  'emailBody',
  'htmlContent',
])

/**
 * Recursively sanitize all string values in an object.
 * Arrays and nested objects are traversed. Non-string primitives pass through.
 */
function sanitizeDeep(obj: unknown, depth = 0): unknown {
  // Prevent stack overflow on deeply nested payloads
  if (depth > 10) return obj

  if (typeof obj === 'string') {
    return sanitizeText(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeDeep(item, depth + 1))
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      // Skip fields that legitimately contain HTML
      if (SKIP_FIELDS.has(key)) {
        result[key] = value
      } else {
        result[key] = sanitizeDeep(value, depth + 1)
      }
    }
    return result
  }

  // numbers, booleans, null — pass through
  return obj
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Only sanitize mutation methods with JSON bodies
  if (
    (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') &&
    req.body &&
    typeof req.body === 'object'
  ) {
    req.body = sanitizeDeep(req.body)
  }
  next()
}
