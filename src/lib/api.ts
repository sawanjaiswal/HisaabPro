import { API_URL, TIMEOUTS } from '@/config/app.config'

interface ApiOptions extends RequestInit {
  timeout?: number
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

/**
 * Fetch wrapper with timeout, auth header, and abort support.
 * Always returns { success, data } or throws.
 */
export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { timeout = TIMEOUTS.fetchMs, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Merge signals: caller's abort + timeout
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort())
  }

  const token = sessionStorage.getItem('accessToken')

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  }).finally(() => clearTimeout(timeoutId))

  const json: ApiResponse<T> = await response.json()

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message || `Request failed (${response.status})`,
      json.error?.code || 'UNKNOWN',
      response.status
    )
  }

  return json.data
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
