/**
 * OCR / Anthropic env helpers.
 */

/**
 * Optional Anthropic API key. When absent, OCR returns OCR_UNAVAILABLE (soft-fail).
 * Set ANTHROPIC_API_KEY in .env to enable receipt OCR.
 */
export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY
}

/**
 * Haiku model used for receipt OCR. Override via EXPENSE_OCR_MODEL (e.g. for testing).
 * Default: claude-haiku-4-5-20251001
 */
export function getOcrModel(): string {
  return process.env.EXPENSE_OCR_MODEL ?? 'claude-haiku-4-5-20251001'
}

/**
 * Maximum decoded image size in bytes before OCR is rejected.
 * Default: 5 MiB (5242880 bytes). Override via EXPENSE_OCR_MAX_BYTES.
 */
export function getOcrMaxBytes(): number {
  const raw = parseInt(process.env.EXPENSE_OCR_MAX_BYTES ?? '', 10)
  return isNaN(raw) ? 5_242_880 : raw
}
