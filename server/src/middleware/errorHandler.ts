/**
 * Centralized error handler middleware — adapted from HisaabPro
 */

import type { Request, Response, NextFunction } from 'express'
import { AppError, handleError } from '../lib/errors.js'
import type { ApiErrorResponse } from '../lib/errors.js'
import logger from '../lib/logger.js'
import { alertServerError } from '../lib/admin-telegram.js'

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const appError = error instanceof AppError ? error : handleError(error)

  // Redact sensitive fields from error details before logging
  const safeDetails = appError.details
    ? Object.fromEntries(
        Object.entries(appError.details).map(([k, v]) =>
          /token|password|secret|otp|authorization/i.test(k)
            ? [k, '[REDACTED]']
            : [k, v]
        )
      )
    : undefined

  logger.error(`[${appError.code}] ${appError.message}`, {
    statusCode: appError.statusCode,
    path: req.path,
    method: req.method,
    ...(safeDetails && { details: safeDetails }),
  })

  // Super-admin Telegram alert for 5xx server errors only (throttled per error code)
  if (appError.statusCode >= 500) {
    alertServerError({
      code: appError.code,
      message: appError.message,
      method: req.method,
      path: req.path,
    })
  }

  const response: ApiErrorResponse = appError.toResponse()
  res.status(appError.statusCode).json(response)
}
