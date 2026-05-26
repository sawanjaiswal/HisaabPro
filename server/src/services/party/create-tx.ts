/**
 * Phase 7 · 7.1C · ARCH M2 — tx-injectable Party creation.
 *
 * `createPartyTx` lifts the canonical Party-creation body out of
 * `services/party/create.ts` so the import path can call it inside an
 * existing chunk transaction (one outer tx per commit chunk, not one
 * per Party). The public `createParty()` continues to wrap a single
 * `prisma.$transaction` around this function so its external contract
 * is unchanged.
 *
 * Provenance:
 *   `opts.importJobId` / `opts.importedBy` populate Party.importJobId
 *   and Party.importedBy when called from invoice fly-create (7.1C) or
 *   the party-import commit ladder (7.1A). Both columns are nullable;
 *   the non-import path passes `{}` and they remain NULL.
 *
 * Duplicate-phone guard:
 *   `@@unique([businessId, phone])` is the DB-level backstop. We
 *   pre-check inside the tx so the caller sees a typed AppError 409
 *   (`DUPLICATE_PARTY_PHONE`) instead of a raw Prisma P2002 — this
 *   makes the invoice resolver's "match existing → fly-create only on
 *   miss" flow correct under concurrent commits.
 */

import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type { CreatePartyInput } from '../../schemas/party.schemas.js'
import { requireGroup } from './helpers.js'
import type { Tx } from '../import/commit.helpers.js'

export interface CreatePartyTxOpts {
  importJobId?: string | null
  importedBy?: string | null
}

export async function createPartyTx(
  tx: Tx,
  businessId: string,
  data: CreatePartyInput,
  opts: CreatePartyTxOpts = {},
) {
  logger.info('Creating party (tx)', {
    businessId,
    partyName: data.name,
    fromImport: Boolean(opts.importJobId),
  })

  // M7 closure (Phase 6 v2.2) — STAFF parties are server-created ONLY via
  // the Employee pairing tx. The import path does not produce STAFF rows.
  if (data.type === 'STAFF') {
    throw new AppError(
      ErrorCode.INVALID_PARTY_TYPE,
      400,
      'STAFF parties cannot be created via this endpoint — use the Employee flow.',
      { reason: 'Created via Employee flow only' },
    )
  }

  // Duplicate-phone guard — preempts P2002 from the (businessId, phone)
  // unique. Phone may legitimately be null/empty on walk-in rows; skip
  // the check then and rely on the DB constraint only when phone is set.
  if (data.phone) {
    const existing = await tx.party.findFirst({
      where: { businessId, phone: data.phone },
      select: { id: true },
    })
    if (existing) {
      throw new AppError(
        ErrorCode.DUPLICATE_ENTRY,
        409,
        `Party with phone ${data.phone} already exists in this business`,
        { existingPartyId: existing.id, phone: data.phone },
      )
    }
  }

  if (data.groupId) {
    await requireGroup(businessId, data.groupId)
  }

  const openingAmount = data.openingBalance
    ? data.openingBalance.type === 'RECEIVABLE'
      ? data.openingBalance.amount
      : -data.openingBalance.amount
    : 0

  const created = await tx.party.create({
    data: {
      businessId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      companyName: data.companyName,
      type: data.type,
      groupId: data.groupId,
      tags: data.tags,
      gstin: data.gstin,
      pan: data.pan,
      creditLimit: data.creditLimit,
      creditLimitMode: data.creditLimitMode,
      notes: data.notes,
      outstandingBalance: openingAmount,
      ...(data.priceListId !== undefined && { priceListId: data.priceListId }),
      ...(opts.importJobId !== undefined && { importJobId: opts.importJobId }),
      ...(opts.importedBy !== undefined && { importedBy: opts.importedBy }),
    },
    select: {
      id: true,
      businessId: true,
      name: true,
      phone: true,
      email: true,
      companyName: true,
      type: true,
      groupId: true,
      tags: true,
      gstin: true,
      pan: true,
      creditLimit: true,
      creditLimitMode: true,
      outstandingBalance: true,
      totalBusiness: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      priceListId: true,
      importJobId: true,
      importedBy: true,
      priceList: { select: { id: true, name: true, isDefault: true } },
    },
  })

  if (data.addresses.length > 0) {
    await tx.partyAddress.createMany({
      data: data.addresses.map((addr) => ({
        partyId: created.id,
        label: addr.label ?? 'Default',
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        type: addr.type,
        isDefault: addr.isDefault,
      })),
    })
  }

  if (data.customFields.length > 0) {
    await tx.partyCustomFieldValue.createMany({
      data: data.customFields.map((cf) => ({
        partyId: created.id,
        fieldId: cf.fieldId,
        value: cf.value,
      })),
    })
  }

  if (data.openingBalance) {
    await tx.openingBalance.create({
      data: {
        partyId: created.id,
        amount: data.openingBalance.amount,
        type: data.openingBalance.type,
        asOfDate: new Date(data.openingBalance.asOfDate),
        notes: data.openingBalance.notes,
      },
    })
  }

  return created
}
