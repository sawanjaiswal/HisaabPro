/**
 * Party creation service.
 *
 * 7.1C PR-C1 (ARCH M2): the canonical body now lives in `create-tx.ts`
 * so the import path can call it inside an existing chunk tx. This file
 * preserves the public `createParty(businessId, data)` contract by
 * wrapping a single `prisma.$transaction` around `createPartyTx` and
 * passing empty provenance opts (non-import path → importJobId/importedBy
 * remain NULL on the new row).
 */

import { prisma } from '../../lib/prisma.js'
import type { CreatePartyInput } from '../../schemas/party.schemas.js'
import { createPartyTx } from './create-tx.js'
// SSE events auto-emitted by middleware/sse-emit.ts on successful responses

export async function createParty(businessId: string, data: CreatePartyInput) {
  return prisma.$transaction((tx) => createPartyTx(tx, businessId, data, {}))
}
