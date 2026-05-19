/**
 * commit-dispatcher.ts — entity → chunk-fn routing tests.
 *
 * Asserts:
 *  1. `entity='parties'` returns the parties chunk function (commits work).
 *  2. `entity='product'` returns the products stub (throws
 *      IMPORT_PRECONDITION_MISSING per M9 / API.B1 contract).
 *  3. Unknown entity throws IMPORT_JOB_NOT_COMMITTABLE.
 */

import { describe, it, expect } from 'vitest'
import { pickCommitChunk } from '../commit-dispatcher.js'
import { commitChunkParties } from '../commit-parties.service.js'
import { commitChunkProducts } from '../commit-products.service.js'
import { AppError, ErrorCode } from '../../../lib/errors.js'

describe('commit-dispatcher · pickCommitChunk', () => {
  it("entity='parties' → commitChunkParties", () => {
    expect(pickCommitChunk('parties')).toBe(commitChunkParties)
  })

  it("entity='product' → commitChunkProducts", () => {
    expect(pickCommitChunk('product')).toBe(commitChunkProducts)
  })

  it("unknown entity → 409 IMPORT_JOB_NOT_COMMITTABLE", () => {
    try {
      pickCommitChunk('invoice')
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).code).toBe(ErrorCode.IMPORT_JOB_NOT_COMMITTABLE)
      expect((err as AppError).statusCode).toBe(409)
    }
  })

  it("empty entity → 409 IMPORT_JOB_NOT_COMMITTABLE", () => {
    expect(() => pickCommitChunk('')).toThrow(AppError)
  })
})

describe('commit-dispatcher · branch identity', () => {
  it('parties vs product return distinct chunk functions', () => {
    expect(pickCommitChunk('parties')).not.toBe(pickCommitChunk('product'))
  })

  it('repeated lookups return stable references (no per-call closure)', () => {
    expect(pickCommitChunk('parties')).toBe(pickCommitChunk('parties'))
    expect(pickCommitChunk('product')).toBe(pickCommitChunk('product'))
  })
})
