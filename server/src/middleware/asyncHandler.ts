import type { Request, Response, NextFunction, RequestHandler } from 'express'

/** Wraps async route handlers — catches errors and forwards to Express error handler */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
