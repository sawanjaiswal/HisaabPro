/**
 * BOM Validators — domain-level guards beyond Zod.
 * Called by bom.service.ts before DB writes.
 */

import { prisma } from '../../lib/prisma.js'

export interface ComponentInput {
  componentProductId: string
  quantity: number
  unitId?: string
  notes?: string
}

export interface ValidateBomComponentsArgs {
  businessId: string
  finishedProductId: string
  components: ComponentInput[]
}

export interface ComponentValidationError {
  code: string
  message: string
  status: number
}

/** Check: no component equals the finished product (self-reference / recursive BOM guard). */
function checkSelfReference(
  finishedProductId: string,
  components: ComponentInput[]
): ComponentValidationError | null {
  const selfRef = components.find(c => c.componentProductId === finishedProductId)
  if (selfRef) {
    return {
      code: 'RECURSIVE_BOM',
      message: 'A component cannot be the same as the finished product',
      status: 400,
    }
  }
  return null
}

/** Check: no duplicate componentProductId within the same BOM. */
function checkDuplicates(components: ComponentInput[]): ComponentValidationError | null {
  const seen = new Set<string>()
  for (const c of components) {
    if (seen.has(c.componentProductId)) {
      return {
        code: 'COMPONENT_INVALID',
        message: 'Duplicate component products are not allowed within the same BOM',
        status: 400,
      }
    }
    seen.add(c.componentProductId)
  }
  return null
}

/** Check: all component products belong to the same business. */
async function checkCrossBusiness(
  businessId: string,
  componentIds: string[]
): Promise<ComponentValidationError | null> {
  const found = await prisma.product.findMany({
    where: { id: { in: componentIds }, businessId, isDeleted: false },
    select: { id: true },
  })
  if (found.length !== componentIds.length) {
    return {
      code: 'COMPONENT_INVALID',
      message: 'One or more component products were not found in this business',
      status: 400,
    }
  }
  return null
}

/** Check: finished product belongs to the business. */
async function checkFinishedProduct(
  businessId: string,
  productId: string
): Promise<ComponentValidationError | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!product) {
    return { code: 'PRODUCT_NOT_FOUND', message: 'Finished product not found', status: 404 }
  }
  return null
}

/**
 * Run all BOM validation guards. Throws an object with { code, message, status }
 * on the first failure.
 */
export async function validateBomComponents(
  args: ValidateBomComponentsArgs
): Promise<void> {
  const { businessId, finishedProductId, components } = args

  const selfErr = checkSelfReference(finishedProductId, components)
  if (selfErr) throw selfErr

  const dupErr = checkDuplicates(components)
  if (dupErr) throw dupErr

  const finishedErr = await checkFinishedProduct(businessId, finishedProductId)
  if (finishedErr) throw finishedErr

  const componentIds = components.map(c => c.componentProductId)
  const crossErr = await checkCrossBusiness(businessId, componentIds)
  if (crossErr) throw crossErr
}
