import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyPin, requestPinReset } from '../pin-gate.service'

const mockApi = vi.fn()
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    api: (...args: unknown[]) => mockApi(...args),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.mockResolvedValue({ success: true })
})

describe('verifyPin', () => {
  it('POSTs to /auth/pin/verify with the supplied PIN', async () => {
    await verifyPin('123456')

    expect(mockApi).toHaveBeenCalledOnce()
    expect(mockApi).toHaveBeenCalledWith(
      '/auth/pin/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pin: '123456' }),
      }),
    )
  })

  it('passes _skipPin: true to prevent the interceptor recursing', async () => {
    await verifyPin('1234')
    expect(mockApi).toHaveBeenCalledWith(
      '/auth/pin/verify',
      expect.objectContaining({ _skipPin: true }),
    )
  })

  it('includes entityType + entityLabel for offline-queue metadata', async () => {
    await verifyPin('1234')
    expect(mockApi).toHaveBeenCalledWith(
      '/auth/pin/verify',
      expect.objectContaining({
        entityType: 'pin',
        entityLabel: 'PIN verification',
      }),
    )
  })

  it('resolves with the server result on success', async () => {
    mockApi.mockResolvedValue({ success: true })
    await expect(verifyPin('1234')).resolves.toEqual({ success: true })
  })

  it('propagates ApiError on 401 INVALID_PIN', async () => {
    const { ApiError } = await import('@/lib/api')
    mockApi.mockRejectedValue(new ApiError('Invalid PIN', 'UNAUTHORIZED', 401, { reason: 'INVALID_PIN' }))

    await expect(verifyPin('9999')).rejects.toBeInstanceOf(ApiError)
    await expect(verifyPin('9999')).rejects.toMatchObject({ status: 401 })
  })

  it('propagates ApiError on 429 PIN_LOCKED with retryAfter detail', async () => {
    const { ApiError } = await import('@/lib/api')
    mockApi.mockRejectedValue(
      new ApiError('PIN locked', 'RATE_LIMITED', 429, { retryAfter: 1800 }),
    )

    await expect(verifyPin('9999')).rejects.toMatchObject({
      status: 429,
      detail: { retryAfter: 1800 },
    })
  })
})

describe('requestPinReset', () => {
  it('POSTs to /auth/pin/reset/request with an empty body and _skipPin', async () => {
    mockApi.mockResolvedValue({ sent: true })
    await requestPinReset()
    expect(mockApi).toHaveBeenCalledWith(
      '/auth/pin/reset/request',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
        _skipPin: true,
        entityType: 'pin',
      }),
    )
  })

  it('resolves with the sent payload', async () => {
    mockApi.mockResolvedValue({ sent: true, message: 'OTP sent' })
    await expect(requestPinReset()).resolves.toEqual({ sent: true, message: 'OTP sent' })
  })
})
