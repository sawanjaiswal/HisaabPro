import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'
import { clearLiveQueryMemoryCache } from '../hooks/useLiveQuery'

beforeEach(() => {
  clearLiveQueryMemoryCache()
})
