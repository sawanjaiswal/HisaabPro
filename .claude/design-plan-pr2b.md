---
status: approved
task: PR2b — Document Custom Fields (Settings UI + Invoice form integration) #134
createdAt: 2026-05-13T20:18:46Z
approvedAt: 2026-05-13T20:21:00Z
---

## Inventory (Phase 0.5)

### Existing reusable UI
- `components/ui/`: Badge, Button, Card, ConfirmDialog, Drawer, Input, Modal, PartyAvatar
- `components/feedback/`: EmptyState, ErrorState, Skeleton, Spinner, ToastContainer
- `components/layout/`: AppShell, Header, PageContainer
- `features/settings/`: SettingsPage, DocumentSettingsPage (toggle-only), useDocumentSettings — `.settings-group`, `.settings-item` CSS already styles list rows
- `features/invoices/`: CreateInvoicePage, EditInvoiceForm, InvoiceDetailsSection (date/payment-terms/vehicle/notes/T&C/signature)
- `features/parties/party-custom-field.service.ts`: already calls `/api/custom-fields` but only PARTY-scoped; no UI page exists for it either

### No existing UI to extend
There is NO custom-fields settings page in HP yet. DOCUMENT scope is new in PR2a — same gap.

## Component map (Phase 1)

| UI Element | Component | Notes |
|------------|-----------|-------|
| Settings page shell | `AppShell` + `Header` + `PageContainer` | matches DocumentSettingsPage |
| Field-defs list rows | reuse `.settings-group` + `.settings-item` CSS | no new CSS |
| "Add field" CTA | `Button variant="primary"` | header action |
| Create/Edit form | `Drawer` (bottom sheet) | HP modal-form pattern |
| Name input | `Input` | |
| Type select | grid buttons (FIELD TEMPLATES "Select grid") | TEXT/NUMBER/DATE/DROPDOWN |
| Document-types multi-select | chip pills (Badge-style toggle) | INVOICE/ESTIMATE/SALE_ORDER/DELIVERY_CHALLAN |
| Required toggle | reuse `.settings-toggle` CSS | same as DocumentSettingsPage |
| Dropdown options editor | textarea (one option per line) | visible only when fieldType=DROPDOWN |
| Delete confirm | `ConfirmDialog` | with field name |
| Loading / Empty / Error | `Skeleton` / `EmptyState` / `ErrorState` | from feedback |
| Invoice "Additional Details" | reuses `.line-items-section` / `.line-item-field` / `.label` / `.input` | no new CSS |
| Invoice TEXT/NUMBER/DATE inputs | raw `.input` class | same as existing fields |
| Invoice DROPDOWN | native `<select className="input">` | minimal |

Variant-first check: every element maps to an existing component, primitive, or established CSS class. **No new component primitives** — only feature-level compositions.

## File plan manifest (each ≤ 250 LOC)

### Part A — Settings UI (5 new + 3 modified)
- `src/features/settings/document-custom-fields.service.ts` (NEW, ~80 LOC)
- `src/features/settings/useDocumentCustomFields.ts` (NEW, ~70 LOC)
- `src/features/settings/DocumentCustomFieldsPage.tsx` (NEW, ~190 LOC)
- `src/features/settings/components/DocumentCustomFieldRow.tsx` (NEW, ~70 LOC)
- `src/features/settings/components/DocumentCustomFieldDrawer.tsx` (NEW, ~220 LOC)
- `src/config/routes.config.ts` (MOD)
- `src/App.tsx` (MOD)
- `src/features/settings/SettingsPage.tsx` (MOD)

### Part B — Invoice form (2 new + 5 modified)
- `src/features/invoices/invoice-custom-fields.service.ts` (NEW, ~45 LOC)
- `src/features/invoices/components/InvoiceCustomFieldsSection.tsx` (NEW, ~180 LOC)
- `src/features/invoices/invoice-api.types.ts` (MOD)
- `src/features/invoices/invoice-form.utils.ts` (MOD)
- `src/features/invoices/useInvoiceForm.ts` (MOD)
- `src/features/invoices/CreateInvoicePage.tsx` (MOD)
- `src/features/invoices/components/EditInvoiceForm.tsx` (MOD)

### Translations (1 file, 2 locales)
- `src/lib/translations.en.ts` + `src/lib/translations.hi.ts` (MOD)

**Total: 7 new files + 8 modified. All new files ≤ 250 LOC.**

## Design tokens

- Colors: `--color-primary-500/100`, `--color-gray-50/0/200`, `--text-primary/secondary/muted`, `--color-error-500`
- Radius: `--radius-xl` row card, `--radius-md` input, `--radius-sm` button, `--radius-lg` drawer
- Font: `--fs-2xl` title, `--fs-lg` section, `--fs-df` row label, `--fs-sm` form labels, `--fs-xs` helper/error
- Spacing: `space-y-6` / `space-y-4` / `px-4` / `mb-1.5`

## Translation keys (EN + HI) — 25 keys

documentCustomFieldsTitle · documentCustomFieldsSubtitle · addCustomField · editCustomField · deleteCustomField · deleteCustomFieldConfirm · fieldNameLabel · fieldTypeLabel · fieldTypeText · fieldTypeNumber · fieldTypeDate · fieldTypeDropdown · fieldRequiredLabel · fieldRequiredDesc · dropdownOptionsLabel · appliesToDocuments · applicableInvoice · applicableEstimate · applicableSaleOrder · applicableDeliveryChallan · noDocumentCustomFields · noDocumentCustomFieldsDesc · additionalDetails · customFieldRequired · customFieldInvalidNumber · saveField · fieldNameRequired · dropdownNeedsOptions · selectOption

## 4 UI states

**Settings page:**
- Loading: 3 Skeleton rows
- Error: ErrorState + retry
- Empty: EmptyState + "Add custom field" CTA
- Success: `.settings-group` list

**Invoice section:**
- Loading: 2 input-shaped skeleton blocks
- Error: silent — server-side validation surfaces on save
- Empty: section doesn't render
- Success: stacked inputs + inline `customFieldRequired` on blur

## Cross-feature impact

- Invoice POST/PUT payload includes optional `customFieldValues` (PR2a Zod accepts)
- EditInvoiceForm hydrates from parallel `GET /api/documents/:id/custom-fields`
- SettingsPage gets one new link under Documents grouping

## Risks & mitigations

- Edit-mode hydration: parallel TanStack `useQueries` — fetch doc detail + custom-fields concurrently
- Dropdown options storage: textarea → split `\n` → trim → filter empty
- DOCUMENT_TYPE_FOR_CUSTOM_FIELDS matches server enum

## Offline compliance

- All calls via `api()`
- Settings mutations pass `entityType: 'custom-field'` + entityLabel
- Invoice custom-field values ride the existing invoice mutation envelope
- No `localStorage`

## Acceptance

- [ ] tsc clean
- [ ] enforce.js clean
- [ ] 4 UI states render
- [ ] CRUD round-trip on settings page
- [ ] Required field blocks invoice save with inline message
- [ ] Invoice POST includes `customFieldValues`; values appear on GET
- [ ] EN + HI translations present
- [ ] No file > 250 LOC
