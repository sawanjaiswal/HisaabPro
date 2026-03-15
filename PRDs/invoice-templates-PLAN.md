# Mission Plan: Invoice Templates & Printing | Status: Awaiting Approval

> **PRD #4**
> **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal
> **Phase:** 1D (MVP)
> **Roadmap Features:** #35, #36, #37, #38, #39
> **Depends on:** PRD #3 — Invoicing & Documents (features #18-#34)
> **Tech:** React-PDF (primary) + Puppeteer (server fallback), Capacitor Print plugin

---

## 1. What

Indian small businesses need professional-looking invoices they can print on whatever hardware they have — thermal receipt printers (58mm/80mm), A4 laser/inkjet, or just share as PDF/image on WhatsApp. Most competitors (Vyapar, MyBillBook) offer 50+ templates but the customization is shallow and confusing.

We ship 5 high-quality base templates that cover every real-world printing scenario, with deep customization (column toggles, field visibility, fonts, colors, logo placement) and smart defaults. Every template handles all 7 document types (sale invoice, purchase invoice, estimate, proforma, purchase order, sale order, delivery challan). Users also get fine-grained control over rounding, decimal precision, and print settings.

**Why this matters:**
- 90% of HisaabPro invoices will be shared via WhatsApp as PDF/image — the invoice IS the brand
- Thermal printers are standard in retail (Rs 3,000-5,000 device) — must support 58mm and 80mm rolls
- Competitors frustrate users with too many templates and not enough customization of each one
- Round-off and decimal precision are daily pain points — wholesalers deal in 3-decimal quantities (e.g., 1.375 kg), retailers want clean round numbers

**Key decisions:**
- React-PDF for client-side generation (works offline, fast, no server dependency)
- Puppeteer as server-side fallback for complex layouts, batch generation, and image export
- Templates are data-driven configs (JSON), not separate React components per template
- All 7 document types share the same template engine — only labels and field visibility change

---

## 2. Domain Model

### Core Entities

```
InvoiceTemplate
├── id: string (cuid)
├── businessId: string (FK → Business)
├── name: string ("My Custom Template")
├── baseTemplate: enum (THERMAL_58MM | THERMAL_80MM | A4_CLASSIC | A4_MODERN | A5_COMPACT | A4_DETAILED)
├── isDefault: boolean (one per document type per business)
├── defaultForTypes: DocumentType[] (which doc types use this as default)
├── config: TemplateConfig (JSON — full layout + field config)
├── printSettings: PrintSettings (JSON)
├── isActive: boolean
├── createdAt: DateTime
├── updatedAt: DateTime
└── deletedAt: DateTime? (soft delete)

TemplateConfig (JSON object — stored in InvoiceTemplate.config)
├── layout
│   ├── logoPosition: "left" | "center" | "right" | "none"
│   ├── logoMaxHeight: number (px, default 60)
│   ├── headerStyle: "stacked" | "side-by-side" | "minimal"
│   ├── itemTableStyle: "bordered" | "striped" | "minimal"
│   ├── summaryPosition: "right" | "center" | "full-width"
│   └── signaturePosition: "left" | "right" | "center"
│
├── columns (which columns appear in line items table)
│   ├── serialNumber: { visible: boolean, label: string }     // default: true, "#"
│   ├── itemName: { visible: true (locked), label: string }   // always visible, "Item"
│   ├── hsn: { visible: boolean, label: string }               // default: false, "HSN/SAC"
│   ├── quantity: { visible: true (locked), label: string }    // always visible, "Qty"
│   ├── unit: { visible: boolean, label: string }              // default: true, "Unit"
│   ├── rate: { visible: true (locked), label: string }        // always visible, "Rate"
│   ├── discount: { visible: boolean, label: string }          // default: false, "Disc"
│   ├── discountAmount: { visible: boolean, label: string }    // default: false, "Disc Amt"
│   ├── taxRate: { visible: boolean, label: string }           // default: false, "Tax %"
│   ├── taxAmount: { visible: boolean, label: string }         // default: false, "Tax Amt"
│   ├── cessRate: { visible: boolean, label: string }          // default: false, "Cess %"
│   ├── cessAmount: { visible: boolean, label: string }        // default: false, "Cess Amt"
│   └── amount: { visible: true (locked), label: string }     // always visible, "Amount"
│
├── fields (which info blocks appear on invoice)
│   ├── businessGstin: boolean      // default: true (if GSTIN exists)
│   ├── businessPan: boolean        // default: false
│   ├── businessPhone: boolean      // default: true
│   ├── businessEmail: boolean      // default: false
│   ├── businessAddress: boolean    // default: true
│   ├── customerGstin: boolean     // default: true (if exists)
│   ├── customerPhone: boolean     // default: true
│   ├── customerAddress: boolean   // default: true
│   ├── shippingAddress: boolean   // default: false (show if different from billing)
│   ├── placeOfSupply: boolean     // default: false (Phase 2 — GST)
│   ├── invoiceNumber: boolean     // default: true (locked — always show)
│   ├── invoiceDate: boolean       // default: true (locked)
│   ├── dueDate: boolean           // default: true
│   ├── poNumber: boolean          // default: false
│   ├── vehicleNumber: boolean     // default: false (for challans)
│   ├── transportDetails: boolean  // default: false
│   ├── bankDetails: boolean       // default: false
│   ├── signature: boolean         // default: false
│   ├── termsAndConditions: boolean // default: false
│   ├── notes: boolean             // default: true
│   ├── totalInWords: boolean      // default: true
│   ├── qrCode: boolean            // default: false (UPI QR or e-invoice QR)
│   └── watermark: boolean         // default: false (DUPLICATE, CANCELLED, ORIGINAL)
│
├── typography
│   ├── fontFamily: "inter" | "noto-sans" | "roboto" | "poppins"  // default: "inter"
│   ├── fontSize: "small" | "medium" | "large"                     // default: "medium"
│   └── headerFontSize: "small" | "medium" | "large"               // default: "large"
│
├── colors
│   ├── accent: string          // hex, default: "#2563EB" (blue-600)
│   ├── headerBg: string        // hex, default: "#FFFFFF"
│   ├── headerText: string      // hex, default: "#111827"
│   ├── tableBorderColor: string // hex, default: "#E5E7EB"
│   ├── tableHeaderBg: string   // hex, default: "#F9FAFB"
│   └── tableHeaderText: string // hex, default: "#111827"
│
├── headerText: string           // custom text above invoice (e.g., "Tax Invoice")
├── footerText: string           // custom text at bottom (e.g., "Thank you for your business!")
└── termsText: string            // default T&C text

PrintSettings (JSON object — stored in InvoiceTemplate.printSettings)
├── pageSize: "A4" | "A5" | "THERMAL_58MM" | "THERMAL_80MM" | "LETTER"  // default varies by template
├── orientation: "portrait" | "landscape"  // default: "portrait"
├── margins: "normal" | "narrow" | "wide" | "none"
│   // normal: 20mm all sides
│   // narrow: 10mm all sides
│   // wide: 30mm all sides
│   // none: 5mm (minimum for most printers)
├── copies: number              // default: 1, max: 5
├── headerOnAllPages: boolean   // default: true (business header on every page)
├── pageNumbers: boolean        // default: true (for multi-page invoices)
└── itemsPerPage: number        // default: 0 (auto-calculate based on page size)

BusinessSettings (separate entity — global settings, not per-template)
├── roundOff
│   ├── enabled: boolean                        // default: true
│   ├── precision: "1" | "0.50" | "0.10" | "none"  // default: "1" (nearest rupee)
│   ├── showOnInvoice: boolean                  // default: true
│   └── method: "round" | "floor" | "ceil"      // default: "round" (standard rounding)
│
├── decimalPrecision
│   ├── quantity: 0 | 1 | 2 | 3               // default: 2
│   ├── rate: 0 | 1 | 2 | 3                   // default: 2
│   └── amount: 2                               // fixed at 2, not configurable
│
└── defaultTemplateId: Record<DocumentType, string>  // default template per document type
```

### Document Types (enum)

```
DocumentType:
  SALE_INVOICE
  PURCHASE_INVOICE
  ESTIMATE
  PROFORMA_INVOICE
  PURCHASE_ORDER
  SALE_ORDER
  DELIVERY_CHALLAN
```

### Document Type Label Mapping

Each document type changes specific labels on the template:

| Field | Sale Invoice | Purchase Invoice | Estimate | Proforma | PO | SO | Challan |
|-------|-------------|-----------------|----------|----------|-----|-----|---------|
| Title | "Tax Invoice" / "Invoice" | "Purchase Invoice" | "Estimate" / "Quotation" | "Proforma Invoice" | "Purchase Order" | "Sale Order" | "Delivery Challan" |
| Number label | "Invoice No." | "Purchase No." | "Estimate No." | "Proforma No." | "PO No." | "SO No." | "Challan No." |
| Date label | "Invoice Date" | "Purchase Date" | "Estimate Date" | "Date" | "PO Date" | "SO Date" | "Challan Date" |
| Party label | "Bill To" | "Supplier" | "To" | "To" | "Order To" | "Order From" | "Deliver To" |
| Due date | Yes | Yes | "Valid Until" | "Valid Until" | "Expected By" | "Delivery By" | N/A |
| Payment info | Yes | Yes | No | No | No | No | No |
| Vehicle no. | No | No | No | No | No | No | Yes |
| Tax columns | Yes (if GST) | Yes (if GST) | Optional | Optional | No | No | No |

---

## 3. User Flows

### Flow 1: Select Template (during invoice creation)

```
Invoice creation screen → Tap "Preview" or "Share"
    │
    ├─→ PDF generated using current default template for this document type
    │
    ├─→ Preview screen shows rendered invoice
    │       ├─→ Pinch to zoom on mobile
    │       ├─→ Swipe left/right to try other templates (template carousel dots at bottom)
    │       ├─→ Bottom bar: [Print] [Share WhatsApp] [Share Email] [Download] [Change Template]
    │       │
    │       └─→ "Change Template" → Template Gallery (bottom sheet)
    │               ├─→ Grid of template thumbnails (2 columns)
    │               ├─→ Each shows: name, preview image, "Default" badge if set
    │               ├─→ Tap → applied to current invoice, preview updates
    │               ├─→ Long press → "Set as Default for [Document Type]"
    │               └─→ "Customize" link on each → Template Customization screen
    │
    └─→ [BRANCH] First time user with no template preference
            └─→ A4 Classic is default for A4, Thermal 80mm for thermal
```

### Flow 2: Template Gallery (from Settings)

```
Settings → Invoice Templates
    │
    ├─→ Template Gallery
    │       ├─→ Section: "Your Templates" (customized versions)
    │       │       ├─→ List of user's templates with preview thumbnails
    │       │       ├─→ Each: name, base template badge, document types it's default for
    │       │       ├─→ Swipe left → Delete (if not the only template)
    │       │       └─→ Tap → Template Customization screen
    │       │
    │       ├─→ Section: "Base Templates" (5 starting points)
    │       │       ├─→ Thermal 58mm — receipt style, narrow
    │       │       ├─→ Thermal 80mm — receipt style, standard
    │       │       ├─→ A4 Classic — traditional, bordered table
    │       │       ├─→ A4 Modern — clean, minimal, colored accents
    │       │       ├─→ A5 Compact — half-page, condensed
    │       │       ├─→ A4 Detailed — all fields shown, HSN, tax columns
    │       │       │
    │       │       └─→ Tap any → "Use This Template" → creates a copy in "Your Templates"
    │       │
    │       └─→ FAB: "+ Create Template" → choose base → customize
    │
    └─→ Default Templates (sub-section)
            ├─→ For each document type, show which template is default
            ├─→ "Sale Invoice: A4 Classic (My Custom)"
            ├─→ "Estimate: A4 Modern"
            ├─→ Tap → change default
            └─→ Can set different defaults for different document types
```

### Flow 3: Template Customization

```
Template Customization screen
    │
    ├─→ Top: Live preview (60% of screen height)
    │       ├─→ Shows a sample invoice with dummy data
    │       ├─→ Updates in real-time as user changes settings
    │       └─→ Tap preview → full-screen preview mode
    │
    ├─→ Bottom: Customization panel (scrollable, 40% height, draggable up)
    │       │
    │       ├─→ Tab 1: Layout
    │       │       ├─→ Template name (editable text field)
    │       │       ├─→ Logo position: [Left] [Center] [Right] [None] — segmented control
    │       │       ├─→ Header style: [Stacked] [Side-by-side] [Minimal] — segmented control
    │       │       ├─→ Table style: [Bordered] [Striped] [Minimal] — segmented control
    │       │       └─→ Summary alignment: [Right] [Center] [Full width]
    │       │
    │       ├─→ Tab 2: Columns
    │       │       ├─→ Toggle switches for each column
    │       │       ├─→ Locked columns (Item, Qty, Rate, Amount) shown as always-on, greyed toggle
    │       │       ├─→ Each toggle: column name + custom label input
    │       │       └─→ Drag to reorder columns (handle on left)
    │       │
    │       ├─→ Tab 3: Fields
    │       │       ├─→ Section: "Business Info" — toggles for GSTIN, PAN, phone, email, address
    │       │       ├─→ Section: "Customer Info" — toggles for GSTIN, phone, address, shipping
    │       │       ├─→ Section: "Invoice Details" — toggles for due date, PO no., vehicle, transport
    │       │       ├─→ Section: "Footer" — toggles for bank details, signature, T&C, notes, total in words, QR
    │       │       └─→ Each toggle shows/hides corresponding area in live preview
    │       │
    │       ├─→ Tab 4: Style
    │       │       ├─→ Font family: dropdown with preview text in each font
    │       │       ├─→ Font size: [Small] [Medium] [Large]
    │       │       ├─→ Accent color: color picker (preset swatches + custom hex)
    │       │       │       Presets: Blue #2563EB, Green #059669, Red #DC2626,
    │       │       │                Purple #7C3AED, Orange #EA580C, Black #111827
    │       │       ├─→ Header background: color picker
    │       │       └─→ Table header background: color picker
    │       │
    │       ├─→ Tab 5: Text
    │       │       ├─→ Header text (above invoice title): editable, e.g., "|| Shree Ganeshay Namah ||"
    │       │       ├─→ Footer text: editable, e.g., "Thank you for your business!"
    │       │       ├─→ Terms & Conditions: multi-line textarea
    │       │       └─→ Each with character count and limit
    │       │
    │       └─→ Tab 6: Print
    │               ├─→ Page size: dropdown
    │               ├─→ Orientation: [Portrait] [Landscape]
    │               ├─→ Margins: [Normal] [Narrow] [Wide] [None]
    │               ├─→ Copies: stepper (1-5)
    │               ├─→ Header on all pages: toggle
    │               └─→ Show page numbers: toggle
    │
    └─→ Bottom bar: [Reset to Default] [Save]
            ├─→ Save → validates, saves, shows toast "Template saved"
            └─→ Reset → confirms "Reset all customizations?" → restores base template defaults
```

### Flow 4: Print Invoice

```
Invoice preview → Tap "Print"
    │
    ├─→ [MOBILE — Capacitor]
    │       ├─→ Generate PDF using React-PDF (client-side, works offline)
    │       ├─→ If thermal template selected:
    │       │       ├─→ Check for connected Bluetooth thermal printer
    │       │       ├─→ Found → send to printer directly (ESC/POS commands)
    │       │       ├─→ Not found → "No thermal printer found. Connect via Bluetooth settings."
    │       │       └─→ Option: "Print as A4 instead"
    │       │
    │       └─→ If A4/A5 template selected:
    │               ├─→ Open system print dialog (Capacitor Print plugin)
    │               ├─→ User selects printer from OS
    │               └─→ Print with template's print settings (copies, margins)
    │
    ├─→ [WEB — Desktop browser]
    │       ├─→ Generate PDF
    │       ├─→ Open browser print dialog (window.print() with @media print styles)
    │       └─→ User selects printer
    │
    └─→ [BATCH PRINT]
            ├─→ From invoice list → select multiple → "Print All"
            ├─→ Generate combined PDF (page break between each)
            └─→ Single print dialog → print all at once
```

### Flow 5: Round-off & Decimal Settings

```
Settings → Invoice Settings
    │
    ├─→ Section: "Round-off"
    │       ├─→ Enable round-off: toggle (default: ON)
    │       ├─→ Round to nearest: [Rs 1] [Rs 0.50] [Rs 0.10] [No rounding]
    │       ├─→ Rounding method: [Standard] [Always down] [Always up]
    │       ├─→ Show round-off on invoice: toggle (default: ON)
    │       └─→ Preview: "Rs 1,234.67 → Rs 1,235.00 (Round-off: +0.33)"
    │
    ├─→ Section: "Decimal Places"
    │       ├─→ Quantity decimals: [0] [1] [2] [3] — default: 2
    │       │       Preview: "1.375 kg" (if 3) / "1.38 kg" (if 2) / "1.4 kg" (if 1) / "1 kg" (if 0)
    │       ├─→ Rate decimals: [0] [1] [2] [3] — default: 2
    │       │       Preview: "Rs 45.50" (if 2) / "Rs 45.500" (if 3)
    │       └─→ Amount: "Always 2 decimal places (Rs XX.XX)" — not editable, shown as info
    │
    └─→ Note: "These settings apply to all new invoices. Existing invoices are not affected."

Per-invoice override (during invoice creation):
    ├─→ Invoice total section → small "Round-off" link
    ├─→ Tap → toggle round-off for THIS invoice
    ├─→ If overridden, shows "(custom)" badge
    └─→ Does not change global setting
```

---

## 4. API Contract

### Template Endpoints

```
GET    /api/v1/templates                    → List all templates for business
GET    /api/v1/templates/:id                → Get single template with full config
POST   /api/v1/templates                    → Create template (from base or duplicate)
PUT    /api/v1/templates/:id                → Update template config
DELETE /api/v1/templates/:id                → Soft-delete template
POST   /api/v1/templates/:id/set-default    → Set as default for document type(s)
POST   /api/v1/templates/:id/duplicate      → Duplicate a template
POST   /api/v1/templates/reset/:baseTemplate → Reset template to base defaults
```

### Settings Endpoints

```
GET    /api/v1/settings/invoice             → Get round-off + decimal settings
PUT    /api/v1/settings/invoice             → Update round-off + decimal settings
```

### PDF Generation Endpoints

```
POST   /api/v1/invoices/:id/pdf             → Generate PDF for single invoice
POST   /api/v1/invoices/:id/image           → Generate JPG/PNG image of invoice
POST   /api/v1/invoices/batch-pdf           → Generate combined PDF for multiple invoices
```

### Detailed Request/Response

#### POST /api/v1/templates

```json
// Request
{
  "name": "My Custom Invoice",
  "baseTemplate": "A4_CLASSIC",
  "config": {
    "layout": {
      "logoPosition": "left",
      "headerStyle": "side-by-side",
      "itemTableStyle": "bordered",
      "summaryPosition": "right",
      "signaturePosition": "right"
    },
    "columns": {
      "serialNumber": { "visible": true, "label": "#" },
      "hsn": { "visible": true, "label": "HSN" },
      "unit": { "visible": true, "label": "Unit" },
      "discount": { "visible": false, "label": "Disc %" },
      "taxRate": { "visible": false, "label": "GST %" },
      "taxAmount": { "visible": false, "label": "Tax" }
    },
    "fields": {
      "businessGstin": true,
      "bankDetails": true,
      "signature": true,
      "termsAndConditions": true,
      "totalInWords": true
    },
    "typography": {
      "fontFamily": "inter",
      "fontSize": "medium"
    },
    "colors": {
      "accent": "#2563EB"
    },
    "headerText": "",
    "footerText": "Thank you for your business!",
    "termsText": "Goods once sold will not be taken back."
  },
  "printSettings": {
    "pageSize": "A4",
    "orientation": "portrait",
    "margins": "normal",
    "copies": 1,
    "headerOnAllPages": true,
    "pageNumbers": true
  }
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "clxyz123...",
    "businessId": "clxyz456...",
    "name": "My Custom Invoice",
    "baseTemplate": "A4_CLASSIC",
    "isDefault": false,
    "defaultForTypes": [],
    "config": { ... },  // full config as sent
    "printSettings": { ... },
    "isActive": true,
    "createdAt": "2026-03-14T10:00:00Z",
    "updatedAt": "2026-03-14T10:00:00Z"
  }
}
```

#### POST /api/v1/templates/:id/set-default

```json
// Request
{
  "documentTypes": ["SALE_INVOICE", "PROFORMA_INVOICE"]
}

// Response (200)
{
  "success": true,
  "data": {
    "id": "clxyz123...",
    "defaultForTypes": ["SALE_INVOICE", "PROFORMA_INVOICE"]
  },
  "message": "Template set as default for Sale Invoice, Proforma Invoice"
}
```

#### PUT /api/v1/settings/invoice

```json
// Request
{
  "roundOff": {
    "enabled": true,
    "precision": "1",
    "showOnInvoice": true,
    "method": "round"
  },
  "decimalPrecision": {
    "quantity": 2,
    "rate": 2
  }
}

// Response (200)
{
  "success": true,
  "data": {
    "roundOff": {
      "enabled": true,
      "precision": "1",
      "showOnInvoice": true,
      "method": "round"
    },
    "decimalPrecision": {
      "quantity": 2,
      "rate": 2,
      "amount": 2
    }
  }
}
```

#### POST /api/v1/invoices/:id/pdf

```json
// Request
{
  "templateId": "clxyz123...",       // optional — uses default if omitted
  "overrideRoundOff": true,          // optional — per-invoice round-off override
  "format": "pdf"                    // "pdf" | "png" | "jpg"
}

// Response (200) — binary PDF with headers:
// Content-Type: application/pdf
// Content-Disposition: attachment; filename="INV-2026-001.pdf"
```

### Offline Behavior

All template CRUD operations work offline via IndexedDB (Dexie):
- Templates stored in `invoiceTemplates` table
- Settings stored in `businessSettings` table
- PDF generation runs entirely client-side via React-PDF (no server needed)
- Server PDF endpoint used only for: batch generation, image export, and server-side sharing (email)
- Sync queue handles template changes when back online

---

## 5. Data Model (Prisma Schema)

```prisma
// ---- Enums ----

enum BaseTemplate {
  THERMAL_58MM
  THERMAL_80MM
  A4_CLASSIC
  A4_MODERN
  A5_COMPACT
  A4_DETAILED
}

enum DocumentType {
  SALE_INVOICE
  PURCHASE_INVOICE
  ESTIMATE
  PROFORMA_INVOICE
  PURCHASE_ORDER
  SALE_ORDER
  DELIVERY_CHALLAN
}

enum RoundOffPrecision {
  ONE          // Rs 1
  HALF         // Rs 0.50
  TEN_PAISE    // Rs 0.10
  NONE         // no rounding
}

enum RoundOffMethod {
  ROUND   // standard rounding (>=0.5 up, <0.5 down)
  FLOOR   // always round down
  CEIL    // always round up
}

// ---- Models ----

model InvoiceTemplate {
  id              String         @id @default(cuid())
  businessId      String
  business        Business       @relation(fields: [businessId], references: [id], onDelete: Cascade)

  name            String         @db.VarChar(100)
  baseTemplate    BaseTemplate
  config          Json           // TemplateConfig — layout, columns, fields, typography, colors, text
  printSettings   Json           // PrintSettings — pageSize, margins, copies, etc.

  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  deletedAt       DateTime?

  // Default template tracking
  defaultFor      TemplateDefault[]

  @@index([businessId])
  @@index([businessId, isActive])
  @@map("invoice_templates")
}

model TemplateDefault {
  id              String         @id @default(cuid())
  businessId      String
  business        Business       @relation(fields: [businessId], references: [id], onDelete: Cascade)

  templateId      String
  template        InvoiceTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  documentType    DocumentType

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([businessId, documentType])  // one default per doc type per business
  @@index([businessId])
  @@map("template_defaults")
}

model InvoiceSettings {
  id              String         @id @default(cuid())
  businessId      String         @unique
  business        Business       @relation(fields: [businessId], references: [id], onDelete: Cascade)

  // Round-off
  roundOffEnabled     Boolean        @default(true)
  roundOffPrecision   RoundOffPrecision @default(ONE)
  roundOffMethod      RoundOffMethod @default(ROUND)
  roundOffShowOnInvoice Boolean      @default(true)

  // Decimal precision
  quantityDecimals    Int            @default(2) @db.SmallInt  // 0-3
  rateDecimals        Int            @default(2) @db.SmallInt  // 0-3
  // amount is always 2 — not stored, enforced in code

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@map("invoice_settings")
}

// ---- Addition to existing Invoice model ----
// (Add these fields to the Invoice model from PRD #3)

model Invoice {
  // ... existing fields from PRD #3 ...

  // Template & round-off per invoice
  templateId        String?           // which template was used to generate PDF
  template          InvoiceTemplate?  @relation(fields: [templateId], references: [id])
  roundOffOverride  Boolean?          // null = use global, true = round, false = don't round
  roundOffAmount    Decimal?          @db.Decimal(10, 2) // actual round-off amount applied

  // ... existing relations ...
}
```

### Dexie (IndexedDB) Schema for Offline

```typescript
// db.ts — Dexie table definitions (additions for templates)

interface DexieInvoiceTemplate {
  id: string;
  businessId: string;
  name: string;
  baseTemplate: BaseTemplate;
  config: TemplateConfig;
  printSettings: PrintSettings;
  isActive: boolean;
  isDefault: boolean;
  defaultForTypes: DocumentType[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  _syncStatus: 'synced' | 'pending' | 'conflict';
}

interface DexieInvoiceSettings {
  id: string;
  businessId: string;
  roundOffEnabled: boolean;
  roundOffPrecision: '1' | '0.50' | '0.10' | 'none';
  roundOffMethod: 'round' | 'floor' | 'ceil';
  roundOffShowOnInvoice: boolean;
  quantityDecimals: number;
  rateDecimals: number;
  _syncStatus: 'synced' | 'pending' | 'conflict';
}

// Dexie stores:
// invoiceTemplates: 'id, businessId, baseTemplate, isActive, [businessId+isActive]'
// invoiceSettings: 'id, &businessId'
```

---

## 6. UI States

### Template Gallery Screen

```
┌─────────────────────────────────────┐
│ ← Invoice Templates          + New  │  ← Top bar
├─────────────────────────────────────┤
│                                     │
│  YOUR TEMPLATES (3)                 │
│  ┌───────────┐  ┌───────────┐      │
│  │ ┌───────┐ │  │ ┌───────┐ │      │
│  │ │preview│ │  │ │preview│ │      │
│  │ │ thumb │ │  │ │ thumb │ │      │
│  │ └───────┘ │  │ └───────┘ │      │
│  │ My Classic│  │ Modern Red│      │
│  │ ★ Default │  │           │      │
│  │ Sale, Est │  │ Proforma  │      │
│  └───────────┘  └───────────┘      │
│  ┌───────────┐                     │
│  │ ┌───────┐ │                     │
│  │ │preview│ │                     │
│  │ │ thumb │ │                     │
│  │ └───────┘ │                     │
│  │ Thermal   │                     │
│  │ ★ Default │                     │
│  │ All types │                     │
│  └───────────┘                     │
│                                     │
│  BASE TEMPLATES                     │
│  ┌───────────┐  ┌───────────┐      │
│  │ Thermal   │  │ Thermal   │      │
│  │  58mm     │  │  80mm     │      │
│  │ [Use]     │  │ [Use]     │      │
│  └───────────┘  └───────────┘      │
│  ┌───────────┐  ┌───────────┐      │
│  │ A4        │  │ A4        │      │
│  │ Classic   │  │ Modern    │      │
│  │ [Use]     │  │ [Use]     │      │
│  └───────────┘  └───────────┘      │
│  ┌───────────┐  ┌───────────┐      │
│  │ A5        │  │ A4        │      │
│  │ Compact   │  │ Detailed  │      │
│  │ [Use]     │  │ [Use]     │      │
│  └───────────┘  └───────────┘      │
│                                     │
└─────────────────────────────────────┘
```

**Empty state:** "No custom templates yet. Choose a base template to get started." + 6 base template cards.

### Template Customization Screen

```
┌─────────────────────────────────────┐
│ ← Customize Template        [Save]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │  ← Live preview (60% height)
│  │     TAX INVOICE              │    │
│  │  [Logo]  Business Name       │    │
│  │          GSTIN: 22AAA...     │    │
│  │          Address line 1      │    │
│  │─────────────────────────────│    │
│  │  Bill To:        Invoice #001│    │
│  │  Customer Name   Date: 14/03│    │
│  │─────────────────────────────│    │
│  │  # │ Item   │ Qty │Rate│Amt │    │
│  │  1 │ Widget │  10 │ 50 │ 500│    │
│  │  2 │ Gadget │   5 │100 │ 500│    │
│  │─────────────────────────────│    │
│  │            Subtotal: 1,000  │    │
│  │            Round-off:  0.00 │    │
│  │            TOTAL:    1,000  │    │
│  │                             │    │
│  │  One Thousand Rupees Only   │    │
│  │  Thank you for your business│    │
│  └─────────────────────────────┘    │
│                                     │
├─────── drag handle ─────────────────┤  ← Draggable divider
│                                     │
│  [Layout] [Columns] [Fields]        │  ← Tab bar
│  [Style]  [Text]    [Print]         │
│                                     │
│  LAYOUT                             │
│  ─────────────────────────────      │
│  Template name: [My Classic     ]   │
│                                     │
│  Logo position                      │
│  [Left] [Center] [Right] [None]     │
│         ▲ selected                  │
│                                     │
│  Header style                       │
│  [Stacked] [Side-by-side] [Minimal] │
│             ▲ selected              │
│                                     │
│  Table style                        │
│  [Bordered] [Striped] [Minimal]     │
│   ▲ selected                        │
│                                     │
│  ─────────────────────────────      │
│  [Reset to Default]                 │
│                                     │
└─────────────────────────────────────┘
```

### Print Preview Screen

```
┌─────────────────────────────────────┐
│ ← Preview                    [...] │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │     Full rendered invoice   │    │  ← Pinch to zoom, scroll
│  │     (actual PDF preview)    │    │
│  │                             │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ● ○ ○ ○ ○                         │  ← Template carousel dots
│  "A4 Classic"                       │  ← Current template name
│                                     │
├─────────────────────────────────────┤
│ [Print] [WhatsApp] [Email] [Save]   │  ← Action bar
└─────────────────────────────────────┘
```

### Invoice Settings Screen (Round-off & Decimals)

```
┌─────────────────────────────────────┐
│ ← Invoice Settings                  │
├─────────────────────────────────────┤
│                                     │
│  ROUND-OFF                          │
│  ─────────────────────────────      │
│  Enable round-off          [ON ]    │
│                                     │
│  Round to nearest                   │
│  [Rs 1] [Rs 0.50] [Rs 0.10] [None] │
│   ▲                                 │
│                                     │
│  Rounding method                    │
│  [Standard] [Always down] [Always up]│
│   ▲                                 │
│                                     │
│  Show on invoice           [ON ]    │
│                                     │
│  Preview:                           │
│  ┌─────────────────────────────┐    │
│  │ Subtotal:    Rs 1,234.67    │    │
│  │ Round-off:       +Rs 0.33  │    │
│  │ TOTAL:       Rs 1,235.00    │    │
│  └─────────────────────────────┘    │
│                                     │
│  DECIMAL PLACES                     │
│  ─────────────────────────────      │
│  Quantity          [0] [1] [2] [3]  │
│                             ▲       │
│  Preview: 1.38 kg                   │
│                                     │
│  Rate              [0] [1] [2] [3]  │
│                             ▲       │
│  Preview: Rs 45.50                  │
│                                     │
│  Amount            2 (fixed)        │
│  Preview: Rs 1,234.00               │
│                                     │
│  ⓘ Changes apply to new invoices    │
│    only. Existing invoices are not  │
│    affected.                        │
│                                     │
└─────────────────────────────────────┘
```

---

## 7. Mobile

### Template Preview on 375px

- Preview takes full width minus 16px padding each side (343px usable)
- A4 invoice scaled down to fit: actual A4 (210mm) scaled to ~343px = 1.63x reduction
- Pinch-to-zoom with max 3x zoom
- Template carousel: swipe horizontally, page indicator dots at bottom
- On small screens (<375px), template gallery switches from 2-column grid to single column

### Customization UI on Mobile

- Live preview takes top 50% of viewport (not 60% — tighter on small screens)
- Customization panel is a bottom sheet with drag handle
- Can drag sheet up to cover 90% of screen (preview shrinks to just the changed area)
- Tab bar scrolls horizontally if all 6 tabs don't fit
- Color picker: 6 preset swatches in a row + "Custom" button that opens full picker
- Font preview: each font option shows "ABC abc 123" in that font

### Print Flow on Mobile

```
Tap "Print" →
├─→ If connected Bluetooth thermal printer detected (Capacitor BLE scan):
│       "Print to [Printer Name]?" → [Print] [Cancel]
│       └─→ Sends ESC/POS formatted receipt
│
├─→ If no thermal printer but thermal template selected:
│       Bottom sheet: "No thermal printer found"
│       [Connect Bluetooth Printer] [Print as A4] [Cancel]
│
├─→ If A4/A5 template:
│       Generate PDF → open system share sheet / print dialog
│       On Android: system print service (WiFi/USB/cloud printers)
│       On iOS: AirPrint dialog
│
└─→ If user has never printed before:
        One-time tooltip: "Tip: For thermal printing, connect your printer via Bluetooth first."
```

### Thermal Receipt Layout (58mm and 80mm)

Thermal receipts have unique constraints:
- 58mm paper = ~32 characters per line (monospace) or ~170px printable width
- 80mm paper = ~42 characters per line (monospace) or ~200px printable width
- No color — monochrome only (accent color ignored)
- Limited fonts — typically monospace
- No images larger than 200px wide (logo auto-resized)
- Receipt is a single continuous roll — no "pages"

```
For 80mm thermal (most common):
┌──────────────────────────────┐
│      [LOGO - 150px max]      │  ← centered, small
│      BUSINESS NAME           │  ← bold, centered
│    123 Market Road, Indore   │
│     GSTIN: 23AAAAA0000A1Z5   │
│     Ph: 98765 43210          │
│──────────────────────────────│
│  TAX INVOICE                 │
│  No: INV-2026-001            │
│  Date: 14/03/2026            │
│──────────────────────────────│
│  To: Rahul Sharma            │
│  Ph: 91234 56789             │
│──────────────────────────────│
│  Item          Qty  Rate  Amt│
│──────────────────────────────│
│  Widget A       10  50.00 500│
│  Gadget B        5 100.00 500│
│  Long Item Na.. 20  25.00 500│  ← truncated with ..
│──────────────────────────────│
│               Subtotal: 1,500│
│              Discount:  -100│
│             Round-off:  0.00│
│                             │
│               TOTAL: Rs 1,400│
│──────────────────────────────│
│  One Thousand Four Hundred   │
│  Rupees Only                 │
│──────────────────────────────│
│  Thank you! Visit again.     │
│                              │
│  [QR CODE - if enabled]      │
│                              │
└──────────────────────────────┘
  ✂ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
```

58mm thermal: same layout but more aggressive truncation, smaller logo (100px max), no total-in-words (too long), columns reduced to: Item / Qty / Amt (rate omitted if space needed).

---

## 8. Edge Cases

### Business Info Edge Cases

| Case | Handling |
|------|----------|
| Business name > 40 chars | A4: full name shown. Thermal: truncate at 30 chars with "..." |
| Business name in Hindi | Noto Sans supports Devanagari. Thermal: depends on printer firmware — fallback to transliteration if unsupported |
| No logo uploaded | Logo area collapses — no blank space left |
| Logo is very wide (banner) | Constrain to max width (A4: 200px, thermal: 150px/100px). Maintain aspect ratio |
| Logo is very tall | Constrain to max height (60px default, configurable up to 100px) |
| Logo file > 500KB | Compress on upload. Reject > 2MB with message "Logo must be under 2MB" |
| No GSTIN (non-GST business) | GSTIN row hidden. Document titled "Invoice" not "Tax Invoice" |
| No address filled | Address block hidden. No blank lines |

### Invoice Content Edge Cases

| Case | Handling |
|------|----------|
| Invoice with 50+ line items | Multi-page: page break after items fill page. Header repeated on page 2+ (if setting enabled). Footer (totals, signature, T&C) on last page only |
| Single line item | Table still rendered with header row + 1 data row |
| Line item name > 60 chars | A4: wrap to 2 lines within cell. Thermal: truncate at available width with "..." |
| Discount is 100% (free item) | Show Rs 0.00 as amount. No negative amounts |
| Very large amounts (Rs 99,99,999.99) | Indian number formatting (Rs 99,99,999.99). Total-in-words handles crore amounts |
| Zero quantity line (service) | Show "1" if qty is 0 or null, with unit "Nos" |
| Negative amounts (returns) | Show with minus sign. Total-in-words prefixed with "Minus" |
| Notes field > 500 chars | Truncate at 500 with "..." in print. Full text in digital PDF |
| T&C > 1000 chars | Overflow to next page if needed. Font size reduced to fit better |

### Thermal Printer Edge Cases

| Case | Handling |
|------|----------|
| Thermal printer not found | "No thermal printer found. Connect via Bluetooth in your device settings." + "Print as A4 instead" option |
| Printer paper jam / out of paper | Timeout after 10s. "Print failed. Check printer paper and try again." |
| Printer disconnects mid-print | "Print may be incomplete. Check receipt and try again." |
| User selects thermal template but no thermal printer | Allow — generates PDF in thermal receipt dimensions (useful for digital sharing of receipt-style invoices) |
| Printer doesn't support Hindi | Detect charset support. Fallback to English labels. Alert: "Your printer may not support Hindi characters" |
| 58mm selected but 80mm printer connected | Print anyway — 58mm content fits on 80mm paper (just extra margins) |
| 80mm selected but 58mm printer connected | Warn: "Content may be cut off. Switch to 58mm template?" |

### Template Edge Cases

| Case | Handling |
|------|----------|
| All optional columns hidden | Table shows: Item, Qty, Rate, Amount (minimum 4 columns — these are locked) |
| All optional fields hidden | Invoice shows: header, line items, total only. Still valid |
| User deletes all custom templates | Base templates always available. Cannot delete base templates |
| User tries to delete default template | "This template is the default for Sale Invoice. Set another default first." |
| Template config corrupted (bad JSON) | Fallback to base template defaults. Log error. Show toast "Template settings reset due to an error" |
| Business upgrades plan — gets more templates | Template limit enforced at creation. Existing templates not deleted if downgrade |
| Offline — template not synced | Use local IndexedDB copy. Templates are synced eagerly (small data) |

### Round-off Edge Cases

| Case | Handling |
|------|----------|
| Round-off makes total > original by Rs 0.50 | Correct behavior — show "+0.50" as round-off line |
| Total is already a round number | Round-off line shows Rs 0.00 or is hidden |
| Per-invoice override conflicts with global | Per-invoice wins. Badge "(custom)" shown in edit view |
| Rs 0.10 precision with Rs 0.05 difference | 0.05 rounds to 0.10 (standard), 0.00 (floor), 0.10 (ceil) |
| Very small total (Rs 0.50) | Rounding still applies. Rs 0.50 rounds to Rs 1 (nearest Rs 1) |

### Decimal Precision Edge Cases

| Case | Handling |
|------|----------|
| Qty = 1.375 but precision set to 2 | Display: 1.38. Stored value: 1.375 (full precision always stored). Calculation uses stored value |
| Rate = 45.5 but precision set to 0 | Display: 46. Stored: 45.5. Calculation uses 45.5. Amount may appear inconsistent — tooltip explains |
| Changing precision after invoices exist | Old invoices not recalculated. Display updated retroactively. Warning shown |
| 3 decimal qty x 3 decimal rate | Amount calculated with full precision, then rounded to 2 decimals for display |

---

## 9. Constraints

### Performance

| Metric | Target | Notes |
|--------|--------|-------|
| PDF generation (single invoice, client-side) | < 2 seconds | React-PDF on mid-range phone (Snapdragon 680) |
| PDF generation (single invoice, server-side) | < 3 seconds | Puppeteer cold start adds ~1s |
| Image export (JPG) | < 3 seconds | Server-side via Puppeteer |
| Batch PDF (10 invoices) | < 10 seconds | Server-side only |
| Template gallery load | < 500ms | 6 thumbnails, lazy load previews |
| Live preview update (on customization change) | < 300ms | Debounced re-render |
| Template save | < 200ms | Local save instant, server sync background |

### Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Max templates per business | 20 | Prevent abuse, keep UX manageable |
| Max template config size | 10KB JSON | Prevent bloat |
| Logo max file size | 2MB | Compress to < 200KB for PDF embedding |
| Logo formats | PNG, JPG, WEBP | SVG not supported in React-PDF |
| Header text max length | 200 characters | Prevent overflow |
| Footer text max length | 500 characters | Prevent overflow |
| Terms text max length | 2000 characters | Reasonable for T&C |
| Custom column label max | 20 characters | Table column header space |
| Font options | 4 (Inter, Noto Sans, Roboto, Poppins) | Must support Devanagari for Hindi |
| Accent color presets | 6 + custom hex | Keep picker simple |
| Print copies max | 5 | Prevent accidental mass printing |
| Items per invoice for PDF | 500 max | Performance ceiling |

### Storage

| Data | Size Estimate | Storage |
|------|--------------|---------|
| Single template config | ~3-5KB | PostgreSQL (server) + IndexedDB (client) |
| All templates for 1 business (max 20) | ~100KB | Synced eagerly — small enough |
| Logo per business | < 200KB (compressed) | S3/Cloudflare R2 (server) + cached locally |
| Generated PDF (single invoice) | 50-200KB | Not stored — generated on demand |
| Generated image (single invoice) | 100-500KB | Not stored — generated on demand |

---

## 10. Out of Scope

| Feature | Why | When |
|---------|-----|------|
| Custom template builder (drag-and-drop) | Too complex for MVP. 5 base templates + customization is enough | Phase 5+ (if demand) |
| Upload custom HTML/CSS template | Security risk, maintenance nightmare | Never (likely) |
| Template marketplace (share/sell templates) | Premature. Need user base first | Phase 7+ |
| Letterhead paper support (skip header on print) | Niche. Can approximate by hiding header fields | Phase 3 if requested |
| Multi-language invoice (bilingual Hindi+English) | Complex layout. Single language per invoice for now | Phase 3 |
| Digital signature with certificate (DSC) | Legal complexity. Image signature is enough for MVP | Phase 2 (with e-invoicing) |
| Watermark on preview (DRAFT/PAID/CANCELLED) | Nice to have but not critical | Phase 2 |
| Template versioning (rollback to previous config) | Over-engineering. Reset to base is enough | Not planned |
| PDF/A compliance (archival format) | Only needed for legal/govt submissions | Phase 2 (with e-invoicing) |
| Automatic printer detection over network | OS handles this via system print dialog | Not needed |
| Custom paper sizes (beyond A4/A5/thermal/letter) | Edge case. 99% of Indian businesses use A4 or thermal | Not planned |
| Receipt email with tracking (opened/viewed) | Email tracking is a Phase 5 feature | Phase 5 |

---

## 11. Build Plan

### Phase 1: Template Engine & Base Templates (5 days)

| Day | Task | Output |
|-----|------|--------|
| 1 | Set up React-PDF, create template rendering engine that takes `TemplateConfig` + invoice data and outputs PDF | `TemplateRenderer` component, `generatePDF()` utility |
| 1 | Define TypeScript types for `TemplateConfig`, `PrintSettings`, `DocumentType` label mapping | `types/template.ts` |
| 2 | Build A4 Classic template (most common — prioritize) | Working A4 Classic PDF output |
| 2 | Build A4 Modern template | Working A4 Modern PDF output |
| 3 | Build A4 Detailed template (all columns, HSN, tax) | Working A4 Detailed PDF output |
| 3 | Build A5 Compact template | Working A5 Compact PDF output |
| 4 | Build Thermal 80mm template (ESC/POS compatible layout) | Working Thermal 80mm output |
| 4 | Build Thermal 58mm template (tighter constraints) | Working Thermal 58mm output |
| 5 | Document type switching (same template, different labels per doc type) | All 7 doc types render correctly on all 6 templates |
| 5 | Indian number formatting, total-in-words (English + Hindi) | `formatIndianNumber()`, `numberToWords()` utilities |

### Phase 2: Template CRUD & Gallery UI (3 days)

| Day | Task | Output |
|-----|------|--------|
| 6 | Prisma schema migration, seed 6 base templates | DB ready, seed script |
| 6 | Backend: template CRUD endpoints (create, read, update, delete, duplicate) | API routes + validation |
| 7 | Backend: set-default endpoint, invoice settings endpoints | API routes |
| 7 | Frontend: Template Gallery screen (base templates + user templates grid) | Gallery page |
| 8 | Frontend: Template preview thumbnails (mini rendered previews) | Thumbnail generation |
| 8 | Dexie schema for offline template storage + sync | Offline-ready |

### Phase 3: Customization UI (3 days)

| Day | Task | Output |
|-----|------|--------|
| 9 | Customization screen: live preview (top) + panel (bottom) | Split-screen layout |
| 9 | Tab 1 (Layout) + Tab 2 (Columns) — toggle switches, segmented controls | Layout + Column customization working |
| 10 | Tab 3 (Fields) + Tab 4 (Style) — field toggles, color picker, font selector | Field + Style customization working |
| 10 | Tab 5 (Text) + Tab 6 (Print) — text editors, print settings | All 6 tabs complete |
| 11 | Real-time preview updates (debounced re-render on config change) | Live preview working < 300ms |
| 11 | Save, reset, duplicate template actions | Full CRUD from UI |

### Phase 4: Print & Share (2 days)

| Day | Task | Output |
|-----|------|--------|
| 12 | Print flow: system print dialog (A4/A5), Capacitor Print plugin integration | Print working on mobile + web |
| 12 | Thermal print: Bluetooth thermal printer ESC/POS command generation | Thermal print working |
| 13 | Share: WhatsApp (PDF + image), Email (PDF attachment), Download | Share flow complete |
| 13 | Image export (JPG/PNG) via Puppeteer server endpoint | Image export working |

### Phase 5: Settings & Polish (2 days)

| Day | Task | Output |
|-----|------|--------|
| 14 | Round-off settings UI + calculation logic + per-invoice override | Round-off fully working |
| 14 | Decimal precision settings UI + display formatting + calculation integration | Decimal precision working |
| 15 | Template carousel in invoice preview (swipe between templates) | Template switching in preview |
| 15 | Edge case handling, error states, empty states, loading states | Polish complete |

**Total: 15 days (3 weeks)**

### Dependencies

```
Phase 1 (Engine) ← no dependency (can start immediately with mock invoice data)
Phase 2 (CRUD)   ← needs PRD #3 Invoice model for the FK relationship
Phase 3 (UI)     ← needs Phase 1 + Phase 2
Phase 4 (Print)  ← needs Phase 1 (templates) + PRD #3 (real invoices)
Phase 5 (Settings) ← needs Phase 1 (calculation logic) + PRD #3 (invoice totals)
```

---

## 12. Acceptance Criteria

### Template Rendering

- [ ] All 6 base templates render correctly with sample data for all 7 document types (6 x 7 = 42 combinations verified)
- [ ] Templates render correctly with 1 line item, 10 line items, and 50+ line items (multi-page)
- [ ] Indian number formatting works: Rs 1,23,456.78 (lakhs/crores, not millions)
- [ ] Total in words works in English ("One Lakh Twenty Three Thousand...") and Hindi
- [ ] Logo renders at correct position and size on all templates
- [ ] Missing optional fields (no GSTIN, no address, no logo) don't leave blank gaps
- [ ] Thermal templates fit within 58mm (170px) and 80mm (200px) print widths
- [ ] Hindi text renders correctly on A4/A5 templates (Noto Sans Devanagari)

### Template CRUD

- [ ] User can create a new template from any base template
- [ ] User can duplicate an existing customized template
- [ ] User can delete a template (unless it's the last one or a default)
- [ ] User can set different default templates for different document types
- [ ] Templates sync correctly between devices (offline-first)
- [ ] Maximum 20 templates per business enforced

### Customization

- [ ] Live preview updates within 300ms of any setting change
- [ ] Column toggles show/hide columns in real-time on preview
- [ ] Field toggles show/hide info blocks in real-time on preview
- [ ] Font change reflects immediately in preview
- [ ] Accent color change reflects immediately in preview (header, table headers, lines)
- [ ] Custom header/footer text appears on preview and final PDF
- [ ] Column labels are customizable (e.g., "Qty" can be renamed to "Quantity" or "Matra")
- [ ] Reset to default restores all settings to base template values

### Print & Share

- [ ] PDF generation completes in < 2 seconds on client-side (mid-range Android phone)
- [ ] PDF opens correctly in any PDF viewer (tested: Chrome, Adobe, Samsung, WPS)
- [ ] WhatsApp share sends PDF with correct filename (e.g., "INV-2026-001.pdf")
- [ ] Image export (JPG) is legible at 1080px width
- [ ] Print dialog opens with correct page size, margins, and copies pre-set
- [ ] Thermal print sends receipt to connected Bluetooth printer
- [ ] If no thermal printer connected, user gets clear error and alternative options
- [ ] Batch print (10 invoices) generates combined PDF with page breaks

### Round-off

- [ ] Round to nearest Rs 1: Rs 1234.67 becomes Rs 1235.00 (round-off: +0.33)
- [ ] Round to nearest Rs 0.50: Rs 1234.67 becomes Rs 1234.50 (round-off: -0.17)
- [ ] Round to nearest Rs 0.10: Rs 1234.67 becomes Rs 1234.70 (round-off: +0.03)
- [ ] No rounding: Rs 1234.67 stays Rs 1234.67 (no round-off line)
- [ ] Floor method: Rs 1234.67 becomes Rs 1234.00 (always down)
- [ ] Ceil method: Rs 1234.67 becomes Rs 1235.00 (always up)
- [ ] Round-off amount displayed on invoice when "show on invoice" is enabled
- [ ] Per-invoice override works and doesn't change global setting
- [ ] Round-off amount stored on invoice record for accounting accuracy

### Decimal Precision

- [ ] Quantity with 0 decimals: 1.375 displays as "1"
- [ ] Quantity with 1 decimal: 1.375 displays as "1.4"
- [ ] Quantity with 2 decimals: 1.375 displays as "1.38"
- [ ] Quantity with 3 decimals: 1.375 displays as "1.375"
- [ ] Rate follows same pattern independently
- [ ] Amount is always 2 decimals regardless of setting
- [ ] Stored values retain full precision — display is formatting only
- [ ] Calculations use stored values, not displayed values (no rounding errors)
- [ ] Existing invoices display correctly when precision setting changes

### Mobile (375px)

- [ ] Template gallery is usable on 375px width (2-column grid or single column)
- [ ] Customization screen: preview visible above, panel scrollable below
- [ ] Color picker works with touch (swatches + custom hex input)
- [ ] Template carousel works with swipe gestures
- [ ] No horizontal scroll on any screen
- [ ] Print flow works on Android (system print) and iOS (AirPrint)

### Offline

- [ ] Templates load from IndexedDB when offline
- [ ] Template customization changes save to IndexedDB when offline
- [ ] PDF generation works fully offline (React-PDF, no server calls)
- [ ] Settings (round-off, decimal) load from IndexedDB when offline
- [ ] When back online, template changes sync to server without conflicts
- [ ] If conflict (same template edited on 2 devices), last-write-wins with notification

---

## Template Layout Reference

### A4 Classic (210mm x 297mm)

```
┌──────────────────────────────────────────────────────────────┐
│  [Logo]  BUSINESS NAME                    TAX INVOICE        │
│          Address line 1, line 2                              │
│          GSTIN: 23AAAAA0000A1Z5    Phone: 98765 43210       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Bill To:                          Invoice No: INV-2026-001  │
│  Customer Name                     Invoice Date: 14/03/2026  │
│  Address line 1                    Due Date: 14/04/2026      │
│  GSTIN: 24BBBBB0000B1Z6           PO No: PO-123             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  #  │ Item Name          │ HSN    │ Qty │ Unit │ Rate  │ Amt │
│─────┼────────────────────┼────────┼─────┼──────┼───────┼─────│
│  1  │ Product Widget A   │ 8471   │  10 │ Pcs  │ 50.00 │ 500 │
│  2  │ Service Setup Fee  │ 9983   │   1 │ Nos  │200.00 │ 200 │
│  3  │ Packaging Material │ 3923   │  20 │ Kg   │ 25.00 │ 500 │
│     │                    │        │     │      │       │     │
│     │                    │        │     │      │       │     │
├──────────────────────────────────────────────────────────────┤
│                                          Subtotal:   1,200   │
│                                          Discount:    -100   │
│                                          CGST (9%):    99    │
│                                          SGST (9%):    99    │
│                                          Round-off:  +0.00   │
│                                          ─────────────────   │
│                                          TOTAL:   Rs 1,298   │
├──────────────────────────────────────────────────────────────┤
│  Total in words: One Thousand Two Hundred Ninety Eight       │
│  Rupees Only                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Bank Details:                     For BUSINESS NAME         │
│  Bank: State Bank of India                                   │
│  A/C: 1234567890                                             │
│  IFSC: SBIN0001234              ___________________          │
│  Branch: Indore Main            Authorized Signatory         │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Terms & Conditions:                                         │
│  1. Goods once sold will not be taken back.                  │
│  2. Interest @18% p.a. will be charged on delayed payments.  │
├──────────────────────────────────────────────────────────────┤
│  Thank you for your business!                    Page 1 of 1 │
└──────────────────────────────────────────────────────────────┘
```

### A4 Modern (210mm x 297mm)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ████████████████████████████████████████████  (accent bar)  │
│                                                              │
│  [Logo - large, centered]                                    │
│                                                              │
│  BUSINESS NAME                                               │
│  Address · Phone · Email                                     │
│  GSTIN: 23AAAAA0000A1Z5                                     │
│                                                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                              │
│             I N V O I C E                                    │
│                                                              │
│  BILLED TO                         INVOICE DETAILS           │
│  Customer Name                     No: INV-2026-001          │
│  Address                           Date: 14 Mar 2026         │
│  GSTIN: 24BBBBB0000B1Z6           Due: 14 Apr 2026          │
│                                                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ITEM                         QTY    RATE    AMOUNT  │    │  ← no borders, colored header bg
│  ├──────────────────────────────────────────────────────┤    │
│  │ Product Widget A               10   50.00     500   │    │
│  │ Service Setup Fee               1  200.00     200   │    │
│  │ Packaging Material             20   25.00     500   │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│                                     Subtotal      1,200      │
│                                     Discount       -100      │
│                                     ──────────────────       │
│                                     TOTAL     Rs 1,100       │
│                                                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                              │
│  One Thousand One Hundred Rupees Only                        │
│                                                              │
│  Notes: [user notes here]                                    │
│                                                              │
│  Thank you for your business!                                │
│                                                              │
│  ████████████████████████████████████████████  (accent bar)  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### A5 Compact (148mm x 210mm)

```
┌──────────────────────────────────────┐
│  [Logo] BUSINESS NAME                │
│  GSTIN: 23AAAAA0000A1Z5             │
│  Ph: 98765 43210                     │
├──────────────────────────────────────┤
│  INVOICE  #INV-2026-001  14/03/2026 │
├──────────────────────────────────────┤
│  To: Customer Name                   │
│  Ph: 91234 56789                     │
├──────────────────────────────────────┤
│  Item          Qty  Rate      Amount │
│  ──────────────────────────────────  │
│  Widget A       10  50.00       500  │
│  Setup Fee       1 200.00       200  │
│  Packaging      20  25.00       500  │
├──────────────────────────────────────┤
│               Subtotal:       1,200  │
│               Discount:        -100  │
│               TOTAL:       Rs 1,100  │
├──────────────────────────────────────┤
│  Rs One Thousand One Hundred Only    │
├──────────────────────────────────────┤
│  Thank you!            Page 1 of 1   │
└──────────────────────────────────────┘
```

### A4 Detailed (210mm x 297mm)

Same as A4 Classic but with all columns enabled by default:

```
#  │ Item Name    │ HSN  │ Qty │ Unit │ Rate  │ Disc% │ Disc Amt │ Taxable │ GST% │ GST Amt │ Cess │ Total
───┼──────────────┼──────┼─────┼──────┼───────┼───────┼──────────┼─────────┼──────┼─────────┼──────┼──────
1  │ Widget A     │ 8471 │  10 │ Pcs  │ 50.00 │  5%   │   25.00  │  475.00 │  18% │   85.50 │  -   │ 560.50
```

Plus: shipping address block, place of supply, transport details, vehicle number, e-way bill number (Phase 2 fields — hidden until GST enabled). Bank details, signature, QR code, and T&C all shown by default.

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Template layouts validated against real competitor invoices (Vyapar, MyBillBook)
- [ ] Thermal template tested on actual 58mm and 80mm printers
- [ ] Hindi text rendering verified with Noto Sans
- [ ] Round-off and decimal logic verified with CA/accountant
- [ ] Prisma schema compatible with PRD #3 Invoice model
