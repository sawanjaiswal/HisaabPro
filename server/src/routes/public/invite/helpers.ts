import crypto from 'node:crypto'
import type { Response } from 'express'
import { PublicLinkError } from '../../../middleware/resolve-public-token.js'

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function handlePublicLinkError(err: unknown, res: Response): boolean {
  if (err instanceof PublicLinkError) {
    res.status(err.httpStatus).json({
      success: false,
      error: { code: err.code, message: err.message },
    })
    return true
  }
  return false
}
