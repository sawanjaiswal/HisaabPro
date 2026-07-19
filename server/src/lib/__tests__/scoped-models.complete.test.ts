/**
 * Completeness test (File #14, tenant-isolation §5.3).
 *
 * DMMF-derived, no DB. Proves the model partition is TOTAL and CONSISTENT so a new
 * schema model can never silently fall through to an unscoped global query:
 *   - every businessId-bearing model is directly-scoped;
 *   - every businessId-free model is EXACTLY one of {child-scoped, global-allowlisted};
 *   - every child rule names a real scalar FK that reaches a directly-scoped parent;
 *   - the global allowlist and the scoped set are disjoint.
 *
 * A wrong FK column, a misclassified child, or a forgotten new model fails CI here.
 */
import { Prisma } from '@prisma/client'
import { describe, it, expect } from 'vitest'
import {
  CHILD_SCOPED,
  GLOBAL_ALLOWLIST,
  SCOPED_MODELS,
} from '../scoped-models.js'

const models = Prisma.dmmf.datamodel.models
const modelByName = new Map(models.map((m) => [m.name, m]))
const hasBusinessId = (name: string): boolean =>
  (modelByName.get(name)?.fields ?? []).some((f) => f.name === 'businessId' && f.kind === 'scalar')

describe('scoped-models partition completeness', () => {
  it('SCOPED_MODELS == exactly the businessId-bearing models', () => {
    const derived = models.filter((m) => hasBusinessId(m.name)).map((m) => m.name).sort()
    expect([...SCOPED_MODELS].sort()).toEqual(derived)
  })

  it('the three classes are pairwise disjoint', () => {
    for (const child of CHILD_SCOPED.keys()) {
      expect(SCOPED_MODELS.has(child), `${child} is both child-scoped and directly-scoped`).toBe(false)
      expect(GLOBAL_ALLOWLIST.has(child), `${child} is both child-scoped and global`).toBe(false)
    }
    for (const g of GLOBAL_ALLOWLIST.keys()) {
      expect(SCOPED_MODELS.has(g), `${g} is both global and directly-scoped`).toBe(false)
    }
  })

  it('every model is classified exactly once (no fall-through)', () => {
    const unclassified: string[] = []
    for (const m of models) {
      const classes =
        (SCOPED_MODELS.has(m.name) ? 1 : 0) +
        (CHILD_SCOPED.has(m.name) ? 1 : 0) +
        (GLOBAL_ALLOWLIST.has(m.name) ? 1 : 0)
      if (classes !== 1) unclassified.push(`${m.name} (in ${classes} classes)`)
    }
    expect(unclassified, `models not classified exactly once:\n${unclassified.join('\n')}`).toEqual([])
  })

  it('every child rule names a real scalar FK reaching a directly-scoped parent', () => {
    for (const [child, rule] of CHILD_SCOPED) {
      const model = modelByName.get(child)
      expect(model, `child model ${child} does not exist`).toBeDefined()
      expect(hasBusinessId(child), `${child} has its own businessId — should be directly-scoped`).toBe(false)

      const fkField = model!.fields.find((f) => f.name === rule.fk && f.kind === 'scalar')
      expect(fkField, `${child}.${rule.fk} is not a scalar field`).toBeDefined()

      const relation = model!.fields.find(
        (f) => f.kind === 'object' && (f.relationFromFields ?? []).includes(rule.fk),
      )
      expect(relation, `${child}.${rule.fk} is not the FK of any relation`).toBeDefined()
      expect(relation!.type, `${child}.${rule.fk} relation targets ${relation!.type}, not ${rule.parent}`).toBe(
        rule.parent,
      )
      expect(SCOPED_MODELS.has(rule.parent), `parent ${rule.parent} of ${child} is not directly-scoped`).toBe(true)
    }
  })

  it('every global-allowlist model exists and has no businessId', () => {
    for (const [name] of GLOBAL_ALLOWLIST) {
      expect(modelByName.get(name), `global model ${name} does not exist in the schema`).toBeDefined()
      expect(hasBusinessId(name), `global model ${name} DOES have businessId — remove from allowlist`).toBe(false)
    }
  })
})
