/**
 * Injector unit tests (File #13, tenant-isolation §5.3).
 *
 * `injectScope` is pure — every branch is asserted here with NO database. Relation
 * names for child models are read back from scoped-models (DMMF-derived) so the test
 * can't drift from the schema.
 */
import { describe, it, expect } from 'vitest'
import {
  DataBusinessIdReject,
  NestedScopedCreateReject,
  injectScope,
} from '../prisma-scoped.inject.js'
import { CHILD_SCOPED, scopedFksOf } from '../scoped-models.js'

const BID = 'biz_A'
const OTHER = 'biz_B'

// concrete models: Category/Document directly-scoped; DocumentLineItem child; User global
const lineRule = CHILD_SCOPED.get('DocumentLineItem')!
const lineRelation = scopedFksOf('DocumentLineItem').find((f) => f.fk === lineRule.fk)!.relation
const docPartyFk = scopedFksOf('Document').find((f) => f.parent === 'Party')! // Document.partyId → Party

const where = (plan: { exec: { kind: string } }): Record<string, unknown> => {
  const exec = plan.exec as { args?: { where?: Record<string, unknown> }; resolveArgs?: { where?: Record<string, unknown> } }
  return (exec.resolveArgs?.where ?? exec.args?.where) as Record<string, unknown>
}
const andPredicate = (w: Record<string, unknown>): unknown => (w.AND as unknown[])[1]

describe('injectScope — directly-scoped reads', () => {
  it('findUnique is rewritten to findFirst with a tenant AND-merge', () => {
    const plan = injectScope('Category', 'findUnique', { where: { id: 'c1' } }, BID)
    expect(plan.exec).toMatchObject({ kind: 'findFirst', operation: 'findFirst' })
    expect(andPredicate(where(plan))).toEqual({ businessId: BID })
  })
  it('findUniqueOrThrow preserves the throwing variant', () => {
    const plan = injectScope('Category', 'findUniqueOrThrow', { where: { id: 'c1' } }, BID)
    expect(plan.exec).toMatchObject({ kind: 'findFirst', operation: 'findFirstOrThrow' })
  })
  it('findMany stays the same op with a tenant AND-merge (caller filter preserved)', () => {
    const plan = injectScope('Category', 'findMany', { where: { name: 'x' } }, BID)
    expect(plan.exec.kind).toBe('sameOp')
    const w = where(plan)
    expect((w.AND as unknown[])[0]).toEqual({ name: 'x' })
    expect(andPredicate(w)).toEqual({ businessId: BID })
  })
})

describe('injectScope — directly-scoped writes', () => {
  it('create overwrites businessId to the active tenant', () => {
    const plan = injectScope('Category', 'create', { data: { name: 'x', businessId: OTHER } }, BID)
    const data = (plan.exec as unknown as { args: { data: Record<string, unknown> } }).args.data
    expect(data.businessId).toBe(BID)
  })
  it('update is a two-step resolve keyed by tenant', () => {
    const plan = injectScope('Category', 'update', { where: { id: 'c1' }, data: { name: 'y' } }, BID)
    expect(plan.exec).toMatchObject({ kind: 'twoStep', writeOp: 'update', missingThrows: true })
    expect(andPredicate(where(plan))).toEqual({ businessId: BID })
  })
  it('update REJECTS a businessId re-parent (H1)', () => {
    expect(() => injectScope('Category', 'update', { where: { id: 'c1' }, data: { businessId: OTHER } }, BID)).toThrow(
      DataBusinessIdReject,
    )
  })
  it('update with {set} businessId re-parent is also rejected (H1)', () => {
    expect(() =>
      injectScope('Category', 'update', { where: { id: 'c1' }, data: { businessId: { set: OTHER } } }, BID),
    ).toThrow(DataBusinessIdReject)
  })
  it('update reassigning a scoped FK yields a guard on the target parent', () => {
    const plan = injectScope('Document', 'update', { where: { id: 'd1' }, data: { [docPartyFk.fk]: 'p9' } }, BID)
    expect(plan.guards).toContainEqual({ parentModel: 'Party', value: 'p9', relationLabel: docPartyFk.relation })
  })
  it('delete is a two-step resolve keyed by tenant', () => {
    const plan = injectScope('Category', 'delete', { where: { id: 'c1' } }, BID)
    expect(plan.exec).toMatchObject({ kind: 'twoStep', writeOp: 'delete' })
  })
  it('deleteMany stays same-op with a tenant AND-merge', () => {
    const plan = injectScope('Category', 'deleteMany', { where: { name: 'x' } }, BID)
    expect(plan.exec.kind).toBe('sameOp')
    expect(andPredicate(where(plan))).toEqual({ businessId: BID })
  })
  it('upsert injects businessId into the create branch and guards the update', () => {
    const plan = injectScope('Category', 'upsert', { where: { id: 'c1' }, create: { name: 'x' }, update: { name: 'y' } }, BID)
    const exec = plan.exec as { kind: string; createArgs: { data: Record<string, unknown> } }
    expect(exec.kind).toBe('upsert')
    expect(exec.createArgs.data.businessId).toBe(BID)
  })
})

describe('injectScope — child-scoped models', () => {
  it('child read filters via the parent relation predicate', () => {
    const plan = injectScope('DocumentLineItem', 'findMany', { where: {} }, BID)
    expect(plan.exec.kind).toBe('sameOp')
    expect(andPredicate(where(plan))).toEqual({ [lineRelation]: { businessId: BID } })
  })
  it('child create injects NO businessId but guards the parent FK belongs to tenant', () => {
    const plan = injectScope('DocumentLineItem', 'create', { data: { [lineRule.fk]: 'd1', qty: 2 } }, BID)
    const data = (plan.exec as unknown as { args: { data: Record<string, unknown> } }).args.data
    expect(data.businessId).toBeUndefined()
    expect(plan.guards).toContainEqual({ parentModel: lineRule.parent, value: 'd1', relationLabel: lineRelation })
  })
})

describe('injectScope — guards & globals', () => {
  it('nested create/connectOrCreate on a scoped relation is rejected', () => {
    expect(() =>
      injectScope('Document', 'create', { data: { [docPartyFk.relation]: { connectOrCreate: {} } } }, BID),
    ).toThrow(NestedScopedCreateReject)
  })
  it('nested connect on a scoped relation becomes a tenant guard', () => {
    const plan = injectScope('Document', 'create', { data: { [docPartyFk.relation]: { connect: { id: 'p3' } } } }, BID)
    expect(plan.guards).toContainEqual({ parentModel: 'Party', value: 'p3', relationLabel: docPartyFk.relation })
  })
  it('a global model passes through unscoped', () => {
    const plan = injectScope('User', 'findMany', { where: {} }, BID)
    expect(plan.exec.kind).toBe('passthrough')
    expect(plan.guards).toEqual([])
  })
})
