/**
 * XSS prevention — direct copy from HisaabPro
 * Escapes HTML entities while preserving Unicode (Hindi, emojis, ₹)
 */

import validator from 'validator'

export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''
  return validator.escape(input.trim())
}
