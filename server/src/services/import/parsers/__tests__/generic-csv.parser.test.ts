import { describe, it, expect, vi } from 'vitest'
import { genericCsvParser } from '../generic-csv.parser.js'
import * as constants from '../../../../constants/import.constants.js'

const ctx = { format: 'GENERIC_CSV' as const }

describe('genericCsvParser', () => {
  it('preserves arbitrary headers as raw keys', async () => {
    const csv =
      'Name,Mobile,Town,Notes\n' +
      'Raju,9111111111,Mumbai,VIP\n' +
      'Priya,9222222222,Pune,\n'
    const res = await genericCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(res.rowCount).toBe(2)
    expect(res.rows[0]!.raw.Name).toBe('Raju')
    expect(res.rows[0]!.raw.Town).toBe('Mumbai')
    expect(res.rows[0]!.raw.Notes).toBe('VIP')
    expect(res.rows[1]!.raw.Notes).toBeUndefined()
  })

  it('rejects empty buffer', async () => {
    await expect(genericCsvParser(Buffer.alloc(0), ctx)).rejects.toMatchObject(
      { code: 'EMPTY_FILE' },
    )
  })

  it('respects MAX_ROWS cap → FILE_TOO_LARGE', async () => {
    // Patch MAX_ROWS to a small value via vi.spyOn on the constants module.
    // Simpler: build a CSV with rowCount > MAX_ROWS=10000. Generating 10001
    // rows in-memory is fine (~200KB) and tests the real path.
    expect(constants.MAX_ROWS).toBe(10_000)
    const rows: string[] = ['Name,Phone']
    for (let i = 0; i < constants.MAX_ROWS + 1; i += 1) {
      rows.push(`P${i},9${String(i).padStart(9, '0')}`)
    }
    const csv = rows.join('\n')
    await expect(
      genericCsvParser(Buffer.from(csv, 'utf8'), ctx),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
  })

  it('returns empty result for header-only CSV', async () => {
    const csv = 'Name,Phone\n'
    const res = await genericCsvParser(Buffer.from(csv, 'utf8'), ctx)
    expect(res.rowCount).toBe(0)
  })

  // silence unused-import warning under noUnusedLocals
  it('exposes vi (no-op)', () => {
    expect(typeof vi.fn).toBe('function')
  })
})
