---
symptom: POST /api/documents rejects every invoice from a non-GST business with 400 "taxCategoryId: Expected string, received null".
root_cause_file: server/src/schemas/document-parts.schemas.ts:1
root_cause_reason: The line-item schema typed the Phase-2 GST fields as `z.string().optional()`, but "untagged" is a real state the form holds as explicit `null` (and the columns are nullable), so a lawful payload failed validation.
---
## 5-whys
1. Why did the save fail? The document create schema rejected the body.
2. Why did it reject it? `taxCategoryId` arrived as `null`; the schema accepted only `string | undefined`.
3. Why does the client send `null`? The invoice form stores an untagged line as `taxCategoryId: null` — the same shape the product schemas accept — and the line-item builder persists `taxCategoryId ?? null`.
4. Why did the schema disagree with both sides? The GST fields were added as `.optional()` only, mirroring a required-string field, without covering the nullable column they write to.
5. Why did nothing catch it? No test posted an untagged line; the seeded GST-enabled fixtures always send a category id.

## Hypothesis
Make the three GST line fields `.nullable().optional()` so the schema matches the column and the form state, and widen the service-side types (`line-item-builder.ts`, `create-tax-prep.ts`) to `string | null` so the nullable output type-checks end to end.

## Failing test
server/src/__tests__/document-schemas.test.ts ("accepts a line whose optional GST fields are null" — failed before, plus a companion case proving wrong types are still rejected)
