import type { Response } from 'express'

/** Standard success response: { success: true, data } */
export function sendSuccess<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data })
}

/** Standard error response: { success: false, error: { code, message } } */
export function sendError(res: Response, message: string, code: string, status = 400) {
  res.status(status).json({
    success: false,
    error: { code, message },
  })
}

/** Paginated response with cursor */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  nextCursor: string | null,
  total?: number
) {
  res.status(200).json({
    success: true,
    data,
    pagination: { nextCursor, total },
  })
}
