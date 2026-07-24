/**
 * Invoice Template — default resolution (set-default).
 *
 * Upserts one TemplateDefault row per requested document type on the unique
 * (businessId, documentType) key — assigning a type to this template supersedes
 * any prior default for that type. Types NOT in the new set are cleared for THIS
 * template ([] clears all of this template's defaults). Returns the template's
 * current default set after the write.
 */

import { prisma } from '../../lib/prisma.js'
import { analyticsEmit } from '../../lib/analytics.js'
import { templateNotFoundError } from './template.constants.js'
import type { DocumentType } from '../../../../shared/enums.js'
import type { SetDefaultResult } from './template.types.js'
import { createAuditEntry } from '../settings/audit.js'

/** POST /api/templates/:id/set-default. */
export async function setDefaultTemplate(
  businessId: string,
  userId: string,
  templateId: string,
  documentTypes: DocumentType[],
): Promise<SetDefaultResult> {
  const template = await prisma.invoiceTemplate.findFirst({
    where: { id: templateId, businessId },
    select: { id: true },
  })
  if (!template) throw templateNotFoundError()

  // De-dup requested types (defensive — Zod allows repeats).
  const wanted = Array.from(new Set(documentTypes))

  await prisma.$transaction(async (tx) => {
    // 1. Point each wanted type at this template (supersede prior default).
    for (const documentType of wanted) {
      await tx.templateDefault.upsert({
        where: { businessId_documentType: { businessId, documentType } },
        create: { businessId, templateId, documentType },
        update: { templateId },
      })
    }

    // 2. Clear this template's defaults for types NOT in the new set.
    await tx.templateDefault.deleteMany({
      where: {
        businessId,
        templateId,
        ...(wanted.length > 0 && { documentType: { notIn: wanted } }),
      },
    })

    await createAuditEntry({
      businessId,
      entityType: 'InvoiceTemplate',
      entityId: templateId,
      entityLabel: null,
      userId,
      action: 'UPDATE',
      changes: { setDefaultFor: wanted },
    }, tx)
  })

  // Read back the current set for this template.
  const rows = await prisma.templateDefault.findMany({
    where: { businessId, templateId },
    select: { documentType: true },
  })
  const defaultForTypes = rows.map((r) => r.documentType as DocumentType)

  analyticsEmit('template_default_set', {
    templateId,
    documentTypesCount: defaultForTypes.length,
  })
  return { id: templateId, defaultForTypes }
}
