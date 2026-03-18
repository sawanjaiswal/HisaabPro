import { describe, it, expect } from 'vitest'
import { ApiError } from '../api'

describe('ApiError', () => {
  it('creates error with message, code, and status', () => {
    const err = new ApiError('Not found', 'NOT_FOUND', 404)
    expect(err.message).toBe('Not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
    expect(err.name).toBe('ApiError')
  })

  it('is an instance of Error', () => {
    const err = new ApiError('fail', 'UNKNOWN', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
  })

  it('has proper stack trace', () => {
    const err = new ApiError('test', 'TEST', 400)
    expect(err.stack).toBeTruthy()
  })
})
