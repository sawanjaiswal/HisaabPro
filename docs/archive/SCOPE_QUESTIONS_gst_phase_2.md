# Questions: GST Phase 2

Answer all questions below. PRD (`docs/SCOPE_gst_phase_2.md`) will be written only after you answer.

---

## What the code already tells me (no questions needed)

These are SETTLED — I will not re-ask:

- Schema: `Business.gstin`, `Business.stateCode`, `Business.compositionScheme`, `Business.eInvoiceEnabled`, `Business.eWayBillEnabled`, `Business.turnoverSlab` — all exist.
- Schema: `Party.gstin`, `Party.stateCode`, `Party.compositionScheme`, `Party.gstinVerified` — all exist.
- Schema: `Product.hsnCode`, `Product.sacCode`, `Product.taxCategoryId` — all exist.
- Schema: `DocumentLineItem` has `taxCategoryId`, `hsnCode`, `sacCode`, `cgstRate/Amount`, `sgstRate/Amount`, `igstRate/Amount`, `cessRate/Amount`, `taxableValue` — all exist.
- Schema: `Document` has `placeOfSupply`, `supplyType`, `isReverseCharge`, `isComposite`, `totalCgst/Sgst/Igst/Cess` — all exist.
- Schema: `TaxCategory`, `HsnCode`, `EInvoice`, `EWayBill`, `GstReturn`, `GstReconciliation` models — all exist.
- Client: `tax-calc.utils.ts` — CGST/SGST vs IGST split logic fully implemented.
- Client: `gstin.utils.ts` — 15-char GSTIN regex + state code extraction + supply type determination — done.
- Client: `GstSettingsPage`, `TaxCategoriesPage`, `CreateTaxCategoryPage` — pages exist.
- Client: `TemplateConfig` already has `businessGstin`, `customerGstin`, `placeOfSupply`, `hsn` column, `taxRate`, `taxAmount`, `cessRate`, `cessAmount` fields — column infrastructure is there.
- Server: `/gstin/validate`, `/gstin/verify`, `/tax-categories` CRUD, `/hsn/search` routes already exist.

---

## Questions I need answered before writing the PRD

### 1. GST Opt-In Gate (CRITICAL — no field exists yet)

The schema has no `gstEnabled Boolean` on `Business`. Currently `Business.gstin` being non-null is the only signal. Should enabling GST be:

**A)** Implicit — adding a GSTIN to the business automatically activates GST billing mode (tax fields appear on invoices, templates switch to GST layout).

**B)** Explicit toggle — a separate "Enable GST" switch in settings that Raju (unregistered) leaves OFF and Priya turns ON. GSTIN is optional even when GST is on (for composition businesses with no output tax).

**C)** Hybrid — GST is always shown but defaults to 0% / exempt, GSTIN is optional, and no hard gate exists.

Which is it? This decision gates everything else in the PRD.

---

### 2. Invoice Form — When does the tax section appear?

Once GST is enabled (per Q1), on the create/edit invoice screen:

a) Does the tax rate picker appear per line item (user picks "GST 18%" per row), or is it a document-level setting ("all items are GST 18%")?

b) Does the user select a TaxCategory from a dropdown, or type an HSN code and get the rate auto-filled?

c) For composition scheme businesses, should invoices still show tax columns (for compliance — composition businesses don't collect GST from customers but need to track their own liability), or hide tax columns entirely and just mark the document "Composition Supply"?

d) When a line item has no tax category assigned (product was created before GST was enabled), should the invoice form: (i) auto-default to 0%/Exempt, (ii) show a warning badge and require the user to pick a rate, or (iii) silently skip and treat as exempt?

---

### 3. Tax-Inclusive vs Tax-Exclusive Pricing on Invoices

The calculator already has `gstMode: inclusive | exclusive`. For the invoice form:

a) Should the selling price (`rate` on a line item) be tax-exclusive by default (user types Rs 100, GST is added on top → invoice shows Rs 118), or tax-inclusive (user types MRP Rs 118, system backs out the tax)?

b) Is this a business-wide setting in invoice settings, or can it be toggled per invoice?

c) Pharma/FMCG use MRP (tax-inclusive). General trade uses tax-exclusive. Which do your three personas primarily use?

---

### 4. Print Templates — GST block

The template config already has the column flags. Three specific decisions needed:

a) Should ALL 30 base templates grow a GST tax summary block (taxable value / CGST / SGST / IGST / cess subtotals table), or only a new "GST" template variant? Updating all 30 is safe (flags are already in `TemplateConfig`) but requires rendering logic in every template's React-PDF component. Creating new GST variants avoids touching existing templates.

b) GSTIN on the template header — should it be a separate line under the business name/address block, or merged into the address block? And for the party (customer) header block, same question.

c) Declaration text — the standard GST declaration is "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct." Do you want this hard-coded, or user-editable per template (like `termsText` already is)?

---

### 5. E-Invoice (IRN) — Feature Flag Details

The schema has `Business.eInvoiceEnabled`. Decisions needed:

a) Who can turn on `eInvoiceEnabled`? (i) Any business (self-declared), (ii) only when `Business.turnoverSlab` is set to `≥5CR`, or (iii) any business but with a warning banner "E-invoice is mandatory only if turnover > Rs 5 crore"?

b) When `eInvoiceEnabled = true` and a SALE_INVOICE is saved, should the system: (i) auto-call NIC IRP and generate IRN immediately on save, (ii) show a "Generate IRN" button on the invoice detail page, or (iii) batch-generate IRNs from a compliance dashboard?

c) If the NIC IRP API call fails (network, NIC downtime), should the invoice save succeed anyway (IRN as best-effort) or block the save?

d) IRN cancellation window is 24 hours (already in constants). After 24h, the only path is amendment via a credit note. Should the UI enforce this window with a countdown and auto-disable the cancel button after 24h?

---

### 6. E-Way Bill — Trigger and Flow

The schema has `Business.eWayBillEnabled`. Decisions needed:

a) E-way bill is required when goods value > Rs 50,000 inter-state (already in constants as `EWAY_BILL_THRESHOLD_PAISE`). Should the invoice form auto-prompt for e-way bill details (transporter, vehicle number, distance, pincodes) when these conditions are met, or should e-way bill generation be a post-invoice action from the detail page?

b) Transport details (vehicle number, driver name) already exist on the `Document` model. For e-way bill, `fromPincode` and `toPincode` are needed on `EWayBill`. Should these be auto-filled from the business pincode and party's billing pincode, or user-entered?

c) Should Part B updates (vehicle change in transit) be supported in v7, or deferred?

---

### 7. GSTR-1 Export — Exact Format

The `GstReturn` model has a `jsonData` column. Decisions:

a) GSTR-1 JSON format must match NIC's offline tool schema (B2B, B2CL, B2CS, CDNR, HSN summary, exports, nil/exempt sections). Should v7 export NIC-compatible JSON that can be imported directly into the GST portal offline tool, or a simpler Excel/CSV format first?

b) GSTR-3B is a summary form. Should v7 include GSTR-3B export as well, or is GSTR-1 the only return in v7?

c) HSN summary (table 12 of GSTR-1) requires: HSN code, description, UQC (unit quantity code), total quantity, total value, taxable value, integrated tax, central tax, state/UT tax, cess. The HSN model has `description` but not UQC. Should UQC be added to the `HsnCode` model, or mapped from the product's unit in the export?

---

### 8. Migration and Existing Data

Businesses with existing invoices (created before GST Phase 2) have `placeOfSupply = null`, `supplyType = 'B2B'` (schema default), and all tax amounts at 0. These will show up wrong in GSTR-1 export.

a) Should existing invoices be excluded from GSTR-1 export (only invoices created after GST was enabled are included), or should there be a backfill option where the user can retroactively assign tax to old invoices?

b) For the `HsnCode` pre-seeded database (12K records) — is it already seeded in production, or is v7 the first release that seeds it?

c) Products created before GST is enabled have `taxCategoryId = null`. When default tax categories are seeded on first GST setup, should a background job assign "Exempt" (0%) as the default tax category to all existing products, or leave them as null (which the invoice form handles per Q2d)?

---

### 9. Persona Staging — v7 vs v8 vs v9

The three personas span very different needs:

- **Raju** (micro, likely unregistered): Wants simple bills. GST is noise. He may have 0% or may not need GST at all.
- **Priya** (growing wholesaler, likely registered): Needs B2B invoices with GSTIN, CGST/SGST, and GSTR-1 export.
- **Amit** (multi-location, definitely registered): Needs e-invoice, e-way bill, GSTR-3B, reconciliation.

Proposed staging — confirm or change:

- **v7**: GST opt-in gate + tax fields on invoice form + GST print templates + GSTR-1 JSON export. (Priya served fully.)
- **v8**: E-invoice IRN via NIC IRP + e-way bill via NIC API. (Amit's compliance needs.)
- **v9**: GSTR-3B, GSTR-9, reconciliation upload. (CA/accountant workflow.)

Does this match your intended release schedule? Any items you want moved earlier or later?

---

### 10. Composition Scheme Specifics

`Business.compositionScheme = true` means the business pays GST at a flat rate (1%/2%/5% of turnover) and cannot issue tax invoices. Instead they issue "Bill of Supply."

a) When `compositionScheme = true`, should the SALE_INVOICE document type be renamed/replaced with "Bill of Supply" on the print template, or should it just suppress the tax breakdown columns?

b) Composition dealers cannot claim ITC. Does HisaabPro need to track this (block ITC claims on purchase invoices for composition businesses), or is that out of scope for v7?

c) `Party.compositionScheme = true` means the customer is a composition dealer — for B2B invoices, this affects whether the supplier can claim ITC. Should the invoice form warn "This party is a composition dealer — they cannot issue tax invoices" when creating purchase invoices from them?

---

### 11. Reverse Charge Mechanism (RCM)

`Document.isReverseCharge = true` already exists in the schema.

a) Which document types should show the RCM toggle? (PURCHASE_INVOICE only, or also SALE_INVOICE for certain notified services like GTA, legal, security?)

b) When RCM is on, should the tax columns still print on the invoice (showing GST liability that the recipient must pay), or should they be hidden and replaced with "Tax payable on reverse charge basis"?

c) Is RCM in scope for v7 or deferred?

---

### 12. Phasing Decision (needed to write the version table in the PRD)

Confirm the v7 scope boundary. "Yes in v7" or "No, defer":

| Feature | In v7? |
|---------|--------|
| GST opt-in toggle on Business | ? |
| GSTIN on Business (already exists) | Already shipped |
| GSTIN on Party (already exists) | Already shipped |
| HSN/SAC on Product (already exists) | Already shipped |
| Tax category picker on Product (already exists) | Already shipped |
| Tax rate picker on invoice line items | ? |
| CGST/SGST/IGST tax calculation on invoice save | ? |
| Place of supply on invoice | ? |
| Supply type auto-classification (B2B/B2C) | ? |
| Composition scheme flag (already in schema) | ? |
| Reverse charge toggle on invoice | ? |
| GST section on print templates | ? |
| GSTR-1 JSON export | ? |
| GSTR-3B export | ? |
| E-invoice (IRN via NIC) | ? |
| E-way bill (via NIC) | ? |
| GSTR-1 reconciliation | ? |
| TDS/TCS on invoices (schema has fields) | ? |

---

### 13. UX Copy — Exact text needed for

- "Enable GST" toggle label and sub-label
- "GST not enabled" empty state on tax settings (CTA button text)
- Composition scheme description text shown under the toggle
- GSTIN verified badge text vs unverified badge text
- Error when GSTIN format is invalid (already have the regex — need the exact user-facing message)
- Success toast when GST settings saved
- Success toast when IRN generated
- Error when NIC IRP is down

---

### 14. Out-of-Scope Confirmation

Please confirm these are explicitly NOT in GST Phase 2 (any version):

- GST filing / direct submission to GST portal (only export, not file)
- GST registration assistance / new GSTIN application
- Multiple GSTIN per business (branch GSTINs)
- Input Tax Credit (ITC) register / 2A/2B reconciliation
- GSTR-9 annual return
- TCS/TDS computation (only capture, not compute)
- Export invoice (with/without payment of IGST) compliance beyond flag
- SEZ supply beyond a flag on the invoice
- Casual taxable person filings
- HSN master edits (read-only seeded data)

Correct, or are any of these actually in scope?

---

**Block:** No PRD will be written until all 14 questions above are answered.
