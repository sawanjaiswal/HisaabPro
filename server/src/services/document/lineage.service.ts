/**
 * Document lineage service — walks the DocumentConversion chain up and down,
 * scoping EVERY hop by businessId (security finding 1.1).
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'

export interface LineageNode {
  id: string
  number: string
  type: string
  status: string
  totalAmount: number
  issueDate: string
}

export interface LineageResult {
  chain: LineageNode[]
  currentIndex: number
}

/** Max hops in each direction — defence-in-depth against cycles / deep chains (security 1.3) */
const MAX_HOPS = 10

const LINEAGE_SELECT = {
  id: true,
  documentNumber: true,
  type: true,
  status: true,
  grandTotal: true,
  documentDate: true,
  sourceDocumentId: true,
} as const

/** Shape returned by LINEAGE_SELECT prisma query */
interface LineageDocRow {
  id: string
  documentNumber: string | null
  type: string
  status: string
  grandTotal: number
  documentDate: Date
  sourceDocumentId: string | null
}

function toNode(doc: LineageDocRow): LineageNode {
  return {
    id: doc.id,
    number: doc.documentNumber ?? '',
    type: doc.type,
    status: doc.status,
    totalAmount: doc.grandTotal,
    issueDate: doc.documentDate instanceof Date
      ? doc.documentDate.toISOString().split('T')[0]
      : String(doc.documentDate),
  }
}

/**
 * Walk UP the chain from `startId` to the root document.
 * Each hop is scoped by businessId — if a linked doc belongs to another
 * tenant the walk stops silently (defense-in-depth per security finding 1.1).
 */
async function walkUp(
  startId: string,
  businessId: string,
  visitedIds: Set<string>
): Promise<LineageNode[]> {
  const ancestors: LineageNode[] = []
  let currentId: string | null = startId

  for (let i = 0; i < MAX_HOPS && currentId !== null; i++) {
    if (visitedIds.has(currentId)) break
    visitedIds.add(currentId)

    const doc: LineageDocRow | null = await prisma.document.findFirst({
      where: { id: currentId, businessId, isDeleted: false },
      select: LINEAGE_SELECT,
    })
    if (!doc) break

    ancestors.unshift(toNode(doc))
    currentId = doc.sourceDocumentId ?? null
  }

  return ancestors
}

/**
 * Walk DOWN the chain from `startId` to the leaf document.
 * Each hop is scoped by businessId (security finding 1.1).
 */
async function walkDown(
  startId: string,
  businessId: string,
  visitedIds: Set<string>
): Promise<LineageNode[]> {
  const descendants: LineageNode[] = []
  let currentId: string | null = startId

  for (let i = 0; i < MAX_HOPS && currentId !== null; i++) {
    if (visitedIds.has(currentId)) break
    visitedIds.add(currentId)

    // The child that references currentId as its sourceDocumentId
    const child: LineageDocRow | null = await prisma.document.findFirst({
      where: { sourceDocumentId: currentId, businessId, isDeleted: false },
      select: LINEAGE_SELECT,
    })
    if (!child) break

    descendants.push(toNode(child))
    currentId = child.id
  }

  return descendants
}

/**
 * Returns the full conversion chain for a document, ordered oldest→newest.
 * Throws 404 if the document is not found in the given business.
 * Throws LINEAGE_TOO_DEEP (500) if the hop cap is exceeded (should never
 * happen in production due to @unique on sourceDocumentId).
 */
export async function getDocumentLineage(params: {
  documentId: string
  businessId: string
}): Promise<LineageResult> {
  const { documentId, businessId } = params

  // Verify the entry document belongs to this business (security 1.1 entry check)
  const entryDoc: LineageDocRow | null = await prisma.document.findFirst({
    where: { id: documentId, businessId, isDeleted: false },
    select: LINEAGE_SELECT,
  })
  if (!entryDoc) throw notFoundError('Document')

  const visitedIds = new Set<string>()

  // Walk up from the entry document's sourceDocumentId (entry itself handled separately)
  const ancestors = entryDoc.sourceDocumentId
    ? await walkUp(entryDoc.sourceDocumentId, businessId, visitedIds)
    : []

  // Entry doc itself
  visitedIds.add(entryDoc.id)
  const selfNode = toNode(entryDoc)

  // Walk down starting from the entry document
  const descendants = await walkDown(entryDoc.id, businessId, visitedIds)

  const chain: LineageNode[] = [...ancestors, selfNode, ...descendants]
  const currentIndex = ancestors.length // position of self in chain

  logger.info('document.lineage.resolved', {
    documentId,
    businessId,
    hops: chain.length,
    currentIndex,
  })

  return { chain, currentIndex }
}
