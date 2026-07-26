/**
 * Party form → server payload mappers — SSOT.
 *
 * `createPartySchema` / `updatePartySchema` (server/src/schemas/party.schemas.ts)
 * are BOTH `.strict()`: an unrecognised key is a 400, not an ignored field. The
 * form's state is a superset of either schema — it also carries display-only
 * GSTIN verification state (`gstinVerified`, `gstinLegalName`, `gstinStatus`),
 * of which only `gstinVerified` is even a Party column and none of which a
 * client is allowed to assert. Sending the form object as-is therefore made
 * every party with a verified GSTIN unsaveable.
 *
 * Both directions go through here so the whitelist cannot drift on one path
 * while the other is fixed — which is exactly what happened before: the update
 * path was whitelisted inline (.claude/fix-trace-party-update.md) and create
 * was left sending the raw form.
 *
 * Adding a field to the server schema? Add it here. That is the only edit
 * needed for it to reach the server.
 */

import { rupeesToPaise } from './party.utils'
import type { PartyFormData } from './party.types'

/** Custom fields with empty values are rejected server-side (`min(1)`). */
function cleanCustomFields(form: PartyFormData): PartyFormData['customFields'] {
  return form.customFields.filter((cf) => cf.value != null && cf.value.trim() !== '')
}

/**
 * The field set `createPartySchema` accepts, and nothing else.
 * Opening balance is entered in rupees and stored in paise.
 */
export function toCreatePartyPayload(form: PartyFormData): PartyFormData {
  return {
    name: form.name,
    phone: form.phone,
    email: form.email,
    companyName: form.companyName,
    type: form.type,
    groupId: form.groupId,
    tags: form.tags,
    gstin: form.gstin,
    pan: form.pan,
    creditLimit: form.creditLimit,
    creditLimitMode: form.creditLimitMode,
    notes: form.notes,
    addresses: form.addresses,
    customFields: cleanCustomFields(form),
    openingBalance: form.openingBalance
      ? { ...form.openingBalance, amount: rupeesToPaise(form.openingBalance.amount) }
      : undefined,
    priceListId: form.priceListId,
  }
}

/**
 * The field set `updatePartySchema` accepts. Narrower than create: addresses
 * and the opening balance are sub-resources with their own endpoints, so
 * including them here would 400 a plain rename.
 */
export function toUpdatePartyPayload(form: PartyFormData): Partial<PartyFormData> {
  return {
    name: form.name,
    phone: form.phone,
    email: form.email,
    companyName: form.companyName,
    type: form.type,
    groupId: form.groupId,
    tags: form.tags,
    gstin: form.gstin,
    pan: form.pan,
    creditLimit: form.creditLimit,
    creditLimitMode: form.creditLimitMode,
    notes: form.notes,
    customFields: cleanCustomFields(form),
    priceListId: form.priceListId,
  }
}
