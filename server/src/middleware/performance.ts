/**
 * Performance monitoring — direct copy from DudhHisaab
 * Logs slow requests (>1s) and adds X-Response-Time header
 */

import type { Request, Response, NextFunction } from 'express'
import logger from '../lib/logger.js'

export function performanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  const originalEnd = res.end

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
    const duration = Date.now() - start

    if (duration > 1000) {
      logger.warn('Slow request', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        status: res.statusCode,
      })
    }

    res.setHeader('X-Response-Time', `${duration}ms`)
    return originalEnd.call(this, chunk, encoding, callback)
  }

  next()
}
