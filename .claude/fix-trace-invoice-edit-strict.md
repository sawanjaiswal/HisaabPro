---
symptom: Editing any invoice from the UI fails with 400 "Unrecognized key(s) in object: 'type'" — the PUT /documents/:id request is rejected before it reaches the update logic, so no invoice can be edited
root_cause_file: src/features/invoices/invoice-crud.service.ts:114
root_cause_reason: updateDocument serializes the entire create-shaped form payload as the PUT body, but updateDocumentSchema is .strict() and forbids the create-only keys (type, clientId, originalDocumentId, creditDebitReason) — `type` is always present (buildInitialForm sets it), so every edit is rejected
---

## 5-whys
1. Why does invoice edit 400? — The server rejects the PUT body with "Unrecognized key(s) in object: 'type'".
2. Why is `type` in the body? — updateDocument sends `JSON.stringify(data)` where `data` is the normalized form payload, and the form always carries `type`.
3. Why does the form carry `type`? — buildInitialForm(type) seeds `type` into DocumentFormData; edit mode hydrates the form from the existing document, which also has a type. `type` is a permanent field of the form shape.
4. Why does the server reject it? — updateDocumentSchema is `.strict()` and deliberately omits `type` (a document's type is immutable after creation) plus clientId/originalDocumentId/creditDebitReason. Strict mode 400s on any unknown key.
5. Why wasn't it caught? — createDocument and updateDocument share one form payload shaped for the create schema; no test asserts the update payload conforms to the (different, stricter) update schema. The create path works, masking the update-path mismatch.

## Hypothesis
The update payload reuses the create-shaped form object verbatim, but the two server schemas diverge: updateDocumentSchema is `.strict()` and forbids the immutable create-only keys `type`, `clientId`, `originalDocumentId`, `creditDebitReason`. Because `type` is always present, every invoice edit is rejected. Fix at the update choke point (updateDocument): strip the create-only keys before serializing the PUT body. entityType/entityLabel still read `data.type` locally before stripping, so offline-queue metadata is preserved.

## Failing test
src/features/invoices/__tests__/invoice-crud.service.test.ts — assert updateDocument sends a body that OMITS `type` (and the other create-only keys) to api(), while still passing entityType derived from the doc type.
