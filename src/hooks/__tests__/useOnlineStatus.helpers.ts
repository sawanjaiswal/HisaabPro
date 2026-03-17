import { vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Shared setup for useOnlineStatus test files.
//
// The hook uses module-level global state that persists between tests.
// We isolate each test by resetting the module registry so that global vars
// (globalIsOnline, globalListeners, heartbeatTimer, etc.) start fresh.
// ---------------------------------------------------------------------------

// Stub fetch before the module loads so the heartbeat never makes real calls.
export const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  // Provide a working default: HEAD /health returns 200
  mockFetch.mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helper: dynamically import the hook AFTER stubs are in place.
// Without resetModules() the module-level globals carry over between tests.
// ---------------------------------------------------------------------------
export async function getHook() {
  const mod = await import('../useOnlineStatus')
  return mod
}
