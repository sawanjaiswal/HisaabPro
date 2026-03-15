/**
 * Centralized error handler middleware — adapted from DudhHisaab
 */

import type { Request, Response, NextFunction } from 'express'
import { AppError, handleError } from '../lib/errors.js'
import type { ApiErrorResponse } from '../lib/errors.js'
import logger from '../lib/logger.js'

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const appError = error instanceof AppError ? error : handleError(error)

  logger.error(`[${appError.code}] ${appError.message}`, {
    statusCode: appError.statusCode,
    path: req.path,
    method: req.method,
    details: appError.details,
  })

  const response: ApiErrorResponse = appError.toResponse()
  res.status(appError.statusCode).json(response)
}
