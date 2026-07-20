---
symptom: Editing an existing party always fails with "Failed to update party."
root_cause_file: src/features/parties/usePartyForm.ts:169
root_cause_reason: The PUT payload spreads the entire form (addresses, openingBalance, gstinVerified/LegalName/Status), but updatePartySchema is .strict() and only accepts the core mutable fields — Zod rejects the unknown keys with a 400.
---
## 5-whys
1. Why does the edit fail? → updateParty() throws (non-409), caught → "Failed to update party."
2. Why does updateParty throw? → PUT /parties/:id returns 400.
3. Why 400? → validate(updatePartySchema) rejects the body.
4. Why rejected? → updatePartySchema.strict() sees keys it doesn't declare (addresses, openingBalance, gstinVerified, gstinLegalName, gstinStatus).
5. Why are those keys in the body? → handleSubmit builds `payload = { ...form, ... }`, and PartyFormData/INITIAL_FORM always carry addresses:[] (+ GSTIN-verify fields, + openingBalance when the party has one). Create accepts them (createPartySchema includes addresses/openingBalance); update does not — addresses & opening balance are edited via their own endpoints.

## Hypothesis
The create and update flows share one form payload, but the two schemas diverge:
createPartySchema includes addresses + openingBalance, updatePartySchema (correctly)
does not, since those are managed by dedicated sub-resource endpoints. The update
branch must send ONLY the keys updatePartySchema declares. Fix = whitelist the
update payload to the schema's field set instead of spreading the whole form.

## Fix
Whitelist the edit-mode payload in handleSubmit to the exact updatePartySchema
field set (name, phone, email, companyName, type, groupId, tags, gstin, pan,
creditLimit, creditLimitMode, notes, customFields, priceListId). addresses,
openingBalance, and the gstin* view-flags are dropped from the update call.
