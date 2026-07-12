# API CONTRACTS — Invoice Templates & Settings

Mount: `['/api/templates', invoiceTemplatesRouter]`,
`['/api/invoice-settings', invoiceSettingsRouter]` in `server/src/app.routes.ts`.
All routes behind `auth`. Envelope: `sendSuccess(res, data)` →
`{ success:true, data }`; errors `{ success:false, error:{ code, message } }`.
`api()` (FE) unwraps `data` — these are the shapes the shipped
`src/features/templates/template.service.ts` already expects.

TS types below are the **wire** shapes. Server DTO types live in
`server/src/services/invoice-template/template.types.ts`; the FE canon lives in
`src/features/templates/template-entity.types.ts` (do not diverge).

```ts
// ─── shared value types (wire) ───────────────────────────────────────────────
type DocumentType =
  | 'SALE_INVOICE' | 'PURCHASE_INVOICE' | 'ESTIMATE' | 'PROFORMA'
  | 'SALE_ORDER' | 'PURCHASE_ORDER' | 'DELIVERY_CHALLAN'
  | 'CREDIT_NOTE' | 'DEBIT_NOTE'                       // = shared/enums DOCUMENT_TYPES

type BaseTemplate = string                              // validated by BASE_TEMPLATE_ALLOWLIST (R1)
type TemplateConfig = Record<string, unknown>           // opaque, <=10KB serialized (R3)
type PrintSettings = Record<string, unknown>            // opaque (R3)

// ─── Templates ───────────────────────────────────────────────────────────────
interface TemplateFormData {                            // POST body / PUT partial
  name: string                                          // 1..100 chars
  baseTemplate: BaseTemplate                            // must be in BASE_TEMPLATE_ALLOWLIST
  config: TemplateConfig                                // <=10KB serialized
  printSettings: PrintSettings
}
interface SetDefaultReq { documentTypes: DocumentType[] }   // [] clears this template's defaults

interface TemplateSummary {                             // list item — NO config/printSettings
  id: string
  name: string
  baseTemplate: BaseTemplate
  isDefault: boolean                                    // derived = defaultForTypes.length > 0
  defaultForTypes: DocumentType[]
  isActive: boolean
  updatedAt: string                                     // ISO
}
interface InvoiceTemplate extends TemplateSummary {
  businessId: string
  config: TemplateConfig
  printSettings: PrintSettings
  createdAt: string                                     // ISO
  deletedAt: string | null
}

// GET    /api/templates                  -> 200 data: TemplateSummary[]
// GET    /api/templates/:id              -> 200 data: InvoiceTemplate            | 404
// POST   /api/templates                  -> 201 data: InvoiceTemplate            | 400 | 401  (X-Idempotency-Key)
// PUT    /api/templates/:id              -> 200 data: InvoiceTemplate            | 400 | 404
// DELETE /api/templates/:id              -> 200 data: { id: string }             | 400 | 404
// POST   /api/templates/:id/duplicate    -> 201 data: InvoiceTemplate            | 404      (X-Idempotency-Key)
// POST   /api/templates/:id/set-default  -> 200 data: { id: string; defaultForTypes: DocumentType[] } | 404

// ─── Invoice settings (singleton per business) ───────────────────────────────
interface InvoiceSettings {
  roundOff: {
    enabled: boolean
    precision: '1' | '0.50' | '0.10' | 'none'
    showOnInvoice: boolean
    method: 'round' | 'floor' | 'ceil'
  }
  decimalPrecision: {
    quantity: 0 | 1 | 2 | 3
    rate: 0 | 1 | 2 | 3
    amount: 2                                            // fixed; echoed
  }
}

// GET /api/invoice-settings              -> 200 data: InvoiceSettings   (upsert-on-read defaults)
// PUT /api/invoice-settings              -> 200 data: InvoiceSettings   (full replace)

// ─── Errors ──────────────────────────────────────────────────────────────────
// { success:false, error:{ code, message } }
//   401 UNAUTHORIZED           "Please sign in to continue."
//   404 TEMPLATE_NOT_FOUND     "Template not found."
//   400 VALIDATION_ERROR       "<field>: <reason>"
//   400 TEMPLATE_LIMIT_REACHED "You can create up to 20 templates. Delete one to add another."
//   400 TEMPLATE_IS_DEFAULT    "This template is the default for one or more document types. Set another default first."
//   429 (limiter default)      + Retry-After
```

## Wire ↔ DB round-off map (R4, lossless)
```
precision:  '1'→ONE  '0.50'→HALF  '0.10'→TEN_PAISE  'none'→NONE
method:     'round'→ROUND  'floor'→FLOOR  'ceil'→CEIL
decimalPrecision.amount is always 2 (not stored)
```
