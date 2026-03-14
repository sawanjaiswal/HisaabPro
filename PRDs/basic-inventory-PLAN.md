# Mission Plan: Basic Inventory | Status: Awaiting Approval

> **PRD #6** | **Module:** 1F — Basic Inventory
> **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal
> **Features:** #44-#49 from Master Roadmap
> **Depends on:** Party Management (1B), Invoicing (1C) — soft dependency only
> **Depended on by:** Invoicing (#18-19 stock deduction), Reports (#53 stock summary), Phase 4 (advanced inventory)

---

## 1. What

A complete product and stock management system for Indian MSMEs. Users can manage products with flexible units and categories, track stock automatically through invoicing, manually adjust stock with audit trail, get alerted on low inventory, define unit conversions for billing convenience, and add custom fields per product.

**Why it matters:**
- 70% of product businesses run on inventory guesswork (PRODUCT_BRIEF.md)
- MyBillBook's #1 gap: "broken inventory, stock at 0 but bills still generate"
- Vyapar users demand unit conversion (1 box = 12 pcs) and custom fields
- Atomic stock operations = zero data inconsistency (our competitive moat)

**Six sub-features:**

| # | Feature | Roadmap | Complexity |
|---|---------|---------|-----------|
| 1 | Products CRUD | #44 | MEDIUM |
| 2 | Stock In/Out | #45 | MEDIUM |
| 3 | Stock Validation | #46 | LOW |
| 4 | Low-Stock Alerts | #47 | LOW |
| 5 | Item Categories & Units | #48 | MEDIUM |
| 6 | Item Custom Fields | #49 | LOW |

---

## 2. Domain Model

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Category   │────<│   Product    │>────│  CustomFieldValue │
└──────────────┘     │              │     └──────────────────┘
                     │  - name      │              │
┌──────────────┐     │  - sku       │     ┌──────────────────┐
│     Unit     │────<│  - salePrice │     │  CustomFieldDef   │
└──────────────┘     │  - stock     │     └──────────────────┘
       │             │  - minStock  │
       │             └──────┬───────┘
┌──────────────┐            │
│UnitConversion│     ┌──────┴───────┐
│              │     │StockMovement │
│ fromUnit ────│     │  - qty       │
│ toUnit ──────│     │  - type      │
│ factor ──────│     │  - reason    │
└──────────────┘     │  - reference │
                     └──────────────┘
```

### Entities

| Entity | Purpose | Key Relations |
|--------|---------|---------------|
| **Product** | Core item that is bought/sold | belongs to Category, Unit; has many StockMovements, CustomFieldValues |
| **Category** | Grouping for products (General, Electronics, etc.) | has many Products; belongs to Business |
| **Unit** | Measurement unit (pcs, kg, ltr, box, etc.) | has many Products; participates in UnitConversions |
| **UnitConversion** | Defines conversion factor between two units | fromUnit → toUnit with multiplier |
| **StockMovement** | Immutable audit log of every stock change | belongs to Product; references Invoice (optional) |
| **CustomFieldDef** | User-defined field template | belongs to Business; has many CustomFieldValues |
| **CustomFieldValue** | Actual value of a custom field for a product | belongs to Product + CustomFieldDef |
| **InventorySetting** | Business-level inventory config | belongs to Business |
| **ProductStockSetting** | Per-product override for stock behavior | belongs to Product |

---

## 3. User Flows

### Flow 1: Add Product

```
Products tab → "+ Add Product"
    │
    ├─→ Basic Info (required)
    │       ├─→ Product name (required, min 1 char, max 200)
    │       ├─→ SKU (auto-generate toggle ON by default → generates "PRD-0001" pattern)
    │       │       └─→ If toggle OFF → user enters manually → validate unique per business
    │       ├─→ Category (dropdown: predefined + custom, default "General")
    │       ├─→ Unit (dropdown: predefined + custom, default "pcs")
    │       ├─→ Sale price (required, >= 0, default 0)
    │       └─→ Purchase price (optional, >= 0, for profit tracking)
    │
    ├─→ Stock Info (collapsible section, open by default)
    │       ├─→ Opening stock (default 0)
    │       ├─→ Minimum stock level (default 0 = no alert)
    │       └─→ Stock validation: "Use global setting" / "Warn only" / "Hard block"
    │
    ├─→ Additional Info (collapsible, collapsed by default)
    │       ├─→ HSN/SAC code (optional, for future GST — Phase 2)
    │       ├─→ Description (optional, max 500 chars)
    │       └─→ Status (Active / Inactive, default Active)
    │
    ├─→ Custom Fields (if any defined for this business)
    │       └─→ Each field rendered by type (text input, number input, date picker, dropdown)
    │
    ├─→ Save
    │       ├─→ Product created in IndexedDB
    │       ├─→ If opening stock > 0 → StockMovement created (type: OPENING, qty: openingStock)
    │       ├─→ Queued for server sync
    │       └─→ Toast: "Product [Name] added"
    │
    └─→ Post-save: "Add Another" / "Done"

    [BRANCH] Duplicate name?
        └─→ Warning (non-blocking): "A product named [X] already exists. Save anyway?"
    [BRANCH] Duplicate SKU?
        └─→ Block: "SKU [X] already exists. Please use a different SKU."
    [BRANCH] Offline?
        └─→ SKU auto-generation uses local counter with business prefix
        └─→ Conflict resolved on sync (server wins, local gets new SKU if collision)
```

### Flow 2: Adjust Stock Manually

```
Product detail → "Adjust Stock" button
    │
    ├─→ Current stock shown: "Current: 45 pcs"
    │
    ├─→ Adjustment type: "Stock In (+)" / "Stock Out (-)"
    │
    ├─→ Quantity (positive number, required)
    │
    ├─→ Reason (required dropdown):
    │       ├─→ Damage
    │       ├─→ Theft
    │       ├─→ Audit correction
    │       ├─→ Gift / Sample
    │       ├─→ Return (not linked to invoice)
    │       └─→ Other (shows text input for custom reason)
    │
    ├─→ Notes (optional free text)
    │
    ├─→ Date (default today, can backdate)
    │
    └─→ Save
            ├─→ StockMovement created atomically (type: ADJUSTMENT_IN or ADJUSTMENT_OUT)
            ├─→ Product.currentStock updated in same transaction
            ├─→ Toast: "Stock adjusted. New stock: 40 pcs"
            └─→ If new stock < minStock → low-stock alert triggered

    [BRANCH] Stock Out would make stock negative?
        ├─→ If "warn only" → Warning: "Stock will go to -5. Continue?"
        └─→ If "hard block" → Block: "Insufficient stock. Current: 45, Adjusting: 50"
```

### Flow 3: Check Low Stock

```
Dashboard → "Low Stock" widget (red badge with count)
    │
    ├─→ Tap → Low Stock List
    │       ├─→ Each row: Product name · Current stock · Min level · Deficit
    │       ├─→ Sorted by: deficit (most urgent first)
    │       ├─→ Filter: Category dropdown
    │       │
    │       ├─→ Tap product → Product detail (with "Adjust Stock" shortcut)
    │       └─→ [FUTURE Phase 4] "Create Purchase Order" shortcut per item
    │
    └─→ Notifications
            ├─→ Push: "3 items below minimum stock level"
            ├─→ In-app badge on Products tab
            └─→ Frequency per setting: once / daily / every time stock changes
```

### Flow 4: Create / Manage Category

```
Settings → Categories (or Products tab → filter → "Manage Categories")
    │
    ├─→ Predefined categories (cannot delete, can hide):
    │       General, Electronics, Grocery, Clothing, Hardware,
    │       Stationery, Food & Beverage, Health & Beauty, Auto Parts, Other
    │
    ├─→ Custom categories:
    │       ├─→ "+ Add Category" → Name (required, unique per business) → Color (optional) → Save
    │       ├─→ Edit → Change name / color
    │       ├─→ Delete → "Move X products to which category?" → select target → confirm
    │       └─→ Reorder (drag handle)
    │
    └─→ Search (for businesses with many categories)
```

### Flow 5: Set Up Unit Conversion

```
Settings → Units & Conversions
    │
    ├─→ Predefined units (cannot delete):
    │       pcs, kg, gm, ltr, ml, box, dozen, meter, cm,
    │       ft, inch, pair, set, bundle, roll, bag, packet, bottle, can
    │
    ├─→ Custom units:
    │       ├─→ "+ Add Unit" → Name (required) · Symbol (required, e.g. "dz") → Save
    │       ├─→ Edit / Delete (only if no products use it, else "Reassign first")
    │
    ├─→ Conversions:
    │       ├─→ "+ Add Conversion"
    │       │       ├─→ From unit: [dropdown] (e.g. "box")
    │       │       ├─→ To unit: [dropdown] (e.g. "pcs")
    │       │       ├─→ Factor: [number] (e.g. 12 → "1 box = 12 pcs")
    │       │       └─→ Save → also creates reverse (1 pcs = 0.0833 box)
    │       │
    │       ├─→ List: "1 box = 12 pcs" · "1 kg = 1000 gm" · "1 dozen = 12 pcs"
    │       ├─→ Edit factor / Delete
    │
    └─→ Usage in billing:
            ├─→ Product stored in base unit (e.g. pcs)
            ├─→ During invoicing: user can select alternative unit
            │       e.g. Product "Nails" stored as pcs, user enters "2 box"
            │       → system calculates: 2 × 12 = 24 pcs deducted from stock
            │       → invoice shows "2 box" but stock decremented by 24 pcs
            └─→ Price auto-converts: if sale price = Rs 5/pcs, box shows Rs 60/box
```

---

## 4. API Contract

All endpoints prefixed with `/api/v1`. Auth via `Authorization: Bearer <jwt>`. Business context via `X-Business-Id` header.

### 4.1 Products

#### `POST /products` — Create product

```typescript
// Request (Zod schema)
const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),       // if omitted, auto-generated
  autoGenerateSku: z.boolean().default(true),
  categoryId: z.string().uuid().optional(),  // null → "General"
  unitId: z.string().uuid(),
  salePrice: z.number().min(0),
  purchasePrice: z.number().min(0).optional(),
  openingStock: z.number().min(0).default(0),
  minStockLevel: z.number().min(0).default(0),
  stockValidation: z.enum(['GLOBAL', 'WARN_ONLY', 'HARD_BLOCK']).default('GLOBAL'),
  hsnCode: z.string().max(8).optional(),
  sacCode: z.string().max(6).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  customFields: z.array(z.object({
    fieldDefId: z.string().uuid(),
    value: z.string(),  // all stored as string, parsed by type
  })).optional(),
});

// Response 201
{
  success: true,
  data: {
    id: "uuid",
    name: "Maggi Noodles",
    sku: "PRD-0001",
    categoryId: "uuid",
    category: { id: "uuid", name: "Grocery" },
    unitId: "uuid",
    unit: { id: "uuid", name: "pcs", symbol: "pcs" },
    salePrice: 14,
    purchasePrice: 12,
    currentStock: 100,
    minStockLevel: 20,
    stockValidation: "GLOBAL",
    hsnCode: null,
    sacCode: null,
    description: null,
    status: "ACTIVE",
    customFields: [],
    createdAt: "2026-03-14T10:00:00Z",
    updatedAt: "2026-03-14T10:00:00Z"
  }
}
```

#### `GET /products` — List products (paginated, filterable)

```typescript
// Query params
const ListProductsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),           // searches name, sku, description
  categoryId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  lowStockOnly: z.coerce.boolean().optional(), // currentStock < minStockLevel
  sortBy: z.enum(['name', 'salePrice', 'purchasePrice', 'currentStock', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Response 200
{
  success: true,
  data: {
    products: [ /* Product objects */ ],
    pagination: {
      page: 1,
      limit: 20,
      total: 156,
      totalPages: 8
    }
  }
}
```

#### `GET /products/:id` — Get single product with stock history

```typescript
// Response 200
{
  success: true,
  data: {
    ...product,
    recentMovements: [ /* last 10 StockMovements */ ]
  }
}
```

#### `PUT /products/:id` — Update product

```typescript
const UpdateProductSchema = CreateProductSchema.partial().omit({
  openingStock: true,  // cannot change opening stock after creation
  autoGenerateSku: true,
});
// Response 200: updated product
```

#### `DELETE /products/:id` — Soft-delete product

```typescript
// Response 200
{ success: true, message: "Product moved to inactive" }
// Note: soft-delete sets status = INACTIVE, does not remove data
// Products referenced by invoices can NEVER be hard-deleted
```

### 4.2 Stock

#### `POST /products/:id/stock/adjust` — Manual stock adjustment

```typescript
const StockAdjustSchema = z.object({
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantity: z.number().positive(),
  reason: z.enum(['DAMAGE', 'THEFT', 'AUDIT', 'GIFT', 'RETURN', 'OTHER']),
  customReason: z.string().max(200).optional(), // required if reason = OTHER
  notes: z.string().max(500).optional(),
  date: z.string().datetime().optional(),       // defaults to now
});

// Response 200
{
  success: true,
  data: {
    movement: { /* StockMovement */ },
    product: {
      id: "uuid",
      currentStock: 40,  // updated stock
      previousStock: 45
    }
  }
}

// Error 400 (hard-block mode, insufficient stock)
{
  success: false,
  error: {
    code: "INSUFFICIENT_STOCK",
    message: "Cannot reduce stock below 0. Current: 45, Requested: 50",
    currentStock: 45,
    requestedQty: 50
  }
}
```

#### `GET /products/:id/stock/movements` — Stock movement log

```typescript
// Query params
const StockMovementQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.enum(['SALE', 'PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'OPENING', 'RETURN_IN', 'RETURN_OUT']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Response 200
{
  success: true,
  data: {
    movements: [
      {
        id: "uuid",
        productId: "uuid",
        type: "SALE",
        quantity: -5,          // negative = stock out
        balanceAfter: 40,
        reason: null,
        referenceType: "INVOICE",
        referenceId: "uuid",   // invoice ID
        referenceNumber: "INV-0042",
        createdBy: { id: "uuid", name: "Priya" },
        createdAt: "2026-03-14T14:30:00Z"
      }
    ],
    pagination: { ... }
  }
}
```

#### `POST /stock/validate` — Pre-validate stock for invoice (called before save)

```typescript
const StockValidateSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitId: z.string().uuid(),  // may differ from product's base unit
  })),
});

// Response 200
{
  success: true,
  data: {
    valid: false,
    items: [
      {
        productId: "uuid",
        productName: "Maggi Noodles",
        requestedQty: 50,       // in base units after conversion
        requestedUnit: "pcs",
        currentStock: 40,
        deficit: 10,
        validation: "WARN",     // WARN | BLOCK | OK
        message: "Only 40 pcs available, 50 requested"
      }
    ]
  }
}
```

### 4.3 Categories

#### `GET /categories` — List all categories

```typescript
// Response 200
{
  success: true,
  data: [
    { id: "uuid", name: "General", type: "PREDEFINED", color: "#6B7280", productCount: 12, sortOrder: 0 },
    { id: "uuid", name: "My Custom", type: "CUSTOM", color: "#EF4444", productCount: 5, sortOrder: 10 }
  ]
}
```

#### `POST /categories` — Create custom category

```typescript
const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
});
// Response 201
```

#### `PUT /categories/:id` — Update category

```typescript
// Only CUSTOM categories can be updated
// Response 200
```

#### `DELETE /categories/:id` — Delete custom category

```typescript
const DeleteCategorySchema = z.object({
  reassignTo: z.string().uuid(),  // required — move products to this category
});
// Response 200
```

### 4.4 Units & Conversions

#### `GET /units` — List all units

```typescript
// Response 200
{
  success: true,
  data: [
    { id: "uuid", name: "pieces", symbol: "pcs", type: "PREDEFINED", productCount: 45 },
    { id: "uuid", name: "kilogram", symbol: "kg", type: "PREDEFINED", productCount: 12 },
    { id: "uuid", name: "carton", symbol: "ctn", type: "CUSTOM", productCount: 3 }
  ]
}
```

#### `POST /units` — Create custom unit

```typescript
const CreateUnitSchema = z.object({
  name: z.string().min(1).max(50),
  symbol: z.string().min(1).max(10),
});
// Response 201
```

#### `PUT /units/:id` — Update custom unit

#### `DELETE /units/:id` — Delete custom unit (only if no products reference it)

#### `GET /unit-conversions` — List all conversions

```typescript
// Response 200
{
  success: true,
  data: [
    {
      id: "uuid",
      fromUnitId: "uuid",
      fromUnit: { name: "box", symbol: "box" },
      toUnitId: "uuid",
      toUnit: { name: "pieces", symbol: "pcs" },
      factor: 12,              // 1 box = 12 pcs
      businessId: "uuid"
    }
  ]
}
```

#### `POST /unit-conversions` — Create conversion

```typescript
const CreateConversionSchema = z.object({
  fromUnitId: z.string().uuid(),
  toUnitId: z.string().uuid(),
  factor: z.number().positive(),
});
// Creates both directions: forward (factor) and reverse (1/factor)
// Response 201
```

#### `PUT /unit-conversions/:id` — Update factor

#### `DELETE /unit-conversions/:id` — Delete conversion (both directions)

### 4.5 Custom Fields

#### `GET /custom-field-defs` — List field definitions

```typescript
// Response 200
{
  success: true,
  data: [
    {
      id: "uuid",
      name: "Warranty Period",
      fieldType: "TEXT",
      isRequired: false,
      showOnInvoice: true,
      isSearchable: true,
      options: null,          // only for DROPDOWN type
      sortOrder: 0
    },
    {
      id: "uuid",
      name: "Color",
      fieldType: "DROPDOWN",
      isRequired: false,
      showOnInvoice: false,
      isSearchable: true,
      options: ["Red", "Blue", "Green", "Black", "White"],
      sortOrder: 1
    }
  ]
}
```

#### `POST /custom-field-defs` — Create field definition

```typescript
const CreateCustomFieldDefSchema = z.object({
  name: z.string().min(1).max(100),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DROPDOWN']),
  isRequired: z.boolean().default(false),
  showOnInvoice: z.boolean().default(false),
  isSearchable: z.boolean().default(true),
  options: z.array(z.string()).optional(),   // required for DROPDOWN
  sortOrder: z.number().int().optional(),
});
// Response 201
```

#### `PUT /custom-field-defs/:id` — Update field definition

#### `DELETE /custom-field-defs/:id` — Delete field definition (removes all values)

### 4.6 Inventory Settings

#### `GET /settings/inventory` — Get inventory settings

```typescript
// Response 200
{
  success: true,
  data: {
    stockValidationMode: "WARN_ONLY",      // WARN_ONLY | HARD_BLOCK
    skuPrefix: "PRD",
    skuAutoGenerate: true,
    lowStockAlertFrequency: "DAILY",       // ONCE | DAILY | EVERY_TIME
    lowStockAlertEnabled: true,
    decimalPrecisionQty: 2,                // decimal places for quantity
    defaultCategoryId: "uuid",
    defaultUnitId: "uuid",
  }
}
```

#### `PUT /settings/inventory` — Update settings

```typescript
const UpdateInventorySettingsSchema = z.object({
  stockValidationMode: z.enum(['WARN_ONLY', 'HARD_BLOCK']).optional(),
  skuPrefix: z.string().max(10).optional(),
  skuAutoGenerate: z.boolean().optional(),
  lowStockAlertFrequency: z.enum(['ONCE', 'DAILY', 'EVERY_TIME']).optional(),
  lowStockAlertEnabled: z.boolean().optional(),
  decimalPrecisionQty: z.number().int().min(0).max(3).optional(),
  defaultCategoryId: z.string().uuid().optional(),
  defaultUnitId: z.string().uuid().optional(),
});
// Response 200
```

### 4.7 Internal Endpoints (called by Invoicing module)

These are NOT exposed as REST — they are service-layer functions called within the same transaction.

```typescript
// Called when Sale Invoice is saved
StockService.deductForSaleInvoice(tx: PrismaTransaction, {
  invoiceId: string,
  invoiceNumber: string,
  items: Array<{
    productId: string,
    quantity: number,       // in base units (already converted)
    unitId: string,
  }>,
  userId: string,
}): Promise<StockMovement[]>

// Called when Purchase Invoice is saved
StockService.addForPurchaseInvoice(tx: PrismaTransaction, {
  invoiceId: string,
  invoiceNumber: string,
  items: Array<{
    productId: string,
    quantity: number,
    unitId: string,
  }>,
  userId: string,
}): Promise<StockMovement[]>

// Called when Invoice is deleted/voided
StockService.reverseForInvoice(tx: PrismaTransaction, {
  invoiceId: string,
  userId: string,
}): Promise<StockMovement[]>
```

---

## 5. Data Model

### Prisma Schema

```prisma
// ─── CATEGORY ───────────────────────────────────────────────

model Category {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  name        String
  type        CategoryType @default(CUSTOM)
  color       String?  @db.VarChar(7)     // hex color e.g. #EF4444
  sortOrder   Int      @default(0) @map("sort_order")
  isHidden    Boolean  @default(false) @map("is_hidden")  // hide predefined without deleting
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  products    Product[]

  @@unique([businessId, name])
  @@index([businessId])
  @@map("categories")
}

enum CategoryType {
  PREDEFINED
  CUSTOM
}

// ─── UNIT ───────────────────────────────────────────────────

model Unit {
  id          String   @id @default(uuid())
  businessId  String?  @map("business_id")  // null = system-level predefined
  name        String                         // "pieces", "kilogram"
  symbol      String   @db.VarChar(10)       // "pcs", "kg"
  type        UnitType @default(CUSTOM)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  business            Business?         @relation(fields: [businessId], references: [id], onDelete: Cascade)
  products            Product[]
  conversionsFrom     UnitConversion[]  @relation("FromUnit")
  conversionsTo       UnitConversion[]  @relation("ToUnit")

  @@unique([businessId, name])
  @@unique([businessId, symbol])
  @@map("units")
}

enum UnitType {
  PREDEFINED
  CUSTOM
}

// ─── UNIT CONVERSION ────────────────────────────────────────

model UnitConversion {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  fromUnitId  String   @map("from_unit_id")
  toUnitId    String   @map("to_unit_id")
  factor      Decimal  @db.Decimal(15, 6)  // 1 fromUnit = factor toUnits
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  fromUnit    Unit     @relation("FromUnit", fields: [fromUnitId], references: [id])
  toUnit      Unit     @relation("ToUnit", fields: [toUnitId], references: [id])

  @@unique([businessId, fromUnitId, toUnitId])
  @@map("unit_conversions")
}

// ─── PRODUCT ────────────────────────────────────────────────

model Product {
  id                String   @id @default(uuid())
  businessId        String   @map("business_id")
  name              String
  sku               String?  @db.VarChar(50)
  categoryId        String?  @map("category_id")
  unitId            String   @map("unit_id")
  salePrice         Decimal  @default(0) @db.Decimal(12, 2) @map("sale_price")
  purchasePrice     Decimal? @db.Decimal(12, 2) @map("purchase_price")
  currentStock      Decimal  @default(0) @db.Decimal(12, 3) @map("current_stock")   // 3 decimals for kg/ltr
  minStockLevel     Decimal  @default(0) @db.Decimal(12, 3) @map("min_stock_level")
  stockValidation   StockValidationMode @default(GLOBAL) @map("stock_validation")
  hsnCode           String?  @db.VarChar(8) @map("hsn_code")
  sacCode           String?  @db.VarChar(6) @map("sac_code")
  description       String?  @db.VarChar(500)
  status            ProductStatus @default(ACTIVE)
  skuCounter        Int      @default(0) @map("sku_counter")  // for auto-generation
  lastLowStockAlert DateTime? @map("last_low_stock_alert")    // for alert frequency
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")              // soft delete

  // Relations
  business          Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  category          Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  unit              Unit     @relation(fields: [unitId], references: [id])
  stockMovements    StockMovement[]
  customFieldValues CustomFieldValue[]
  productStockSetting ProductStockSetting?

  @@unique([businessId, sku])
  @@index([businessId, status])
  @@index([businessId, categoryId])
  @@index([businessId, name])
  @@index([businessId, currentStock, minStockLevel])  // for low-stock queries
  @@map("products")
}

enum ProductStatus {
  ACTIVE
  INACTIVE
}

enum StockValidationMode {
  GLOBAL       // use business-level setting
  WARN_ONLY    // allow negative stock with warning
  HARD_BLOCK   // prevent save if insufficient
}

// ─── STOCK MOVEMENT ─────────────────────────────────────────

model StockMovement {
  id              String   @id @default(uuid())
  businessId      String   @map("business_id")
  productId       String   @map("product_id")
  type            StockMovementType
  quantity        Decimal  @db.Decimal(12, 3)  // positive = in, negative = out
  balanceAfter    Decimal  @db.Decimal(12, 3) @map("balance_after")
  reason          StockAdjustmentReason?
  customReason    String?  @db.VarChar(200) @map("custom_reason")
  notes           String?  @db.VarChar(500)
  referenceType   StockReferenceType? @map("reference_type")
  referenceId     String?  @map("reference_id")     // invoice ID or other doc ID
  referenceNumber String?  @map("reference_number")  // "INV-0042" for display
  movementDate    DateTime @default(now()) @map("movement_date")
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")

  // Relations
  business        Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  product         Product  @relation(fields: [productId], references: [id])
  user            User     @relation(fields: [createdBy], references: [id])

  // Immutable — no updatedAt, no edits, no deletes
  // To reverse: create a new opposite movement

  @@index([productId, createdAt])
  @@index([businessId, movementDate])
  @@index([referenceType, referenceId])
  @@map("stock_movements")
}

enum StockMovementType {
  OPENING          // initial stock when product created
  SALE             // auto-deducted on sale invoice save
  PURCHASE         // auto-added on purchase invoice save
  SALE_RETURN      // auto-added on sale return/credit note
  PURCHASE_RETURN  // auto-deducted on purchase return/debit note
  ADJUSTMENT_IN    // manual increase
  ADJUSTMENT_OUT   // manual decrease
  REVERSAL         // reversal of a previous movement (invoice delete/void)
}

enum StockAdjustmentReason {
  DAMAGE
  THEFT
  AUDIT
  GIFT
  RETURN
  OTHER
}

enum StockReferenceType {
  SALE_INVOICE
  PURCHASE_INVOICE
  CREDIT_NOTE
  DEBIT_NOTE
  ADJUSTMENT
}

// ─── CUSTOM FIELD DEFINITION ────────────────────────────────

model CustomFieldDef {
  id            String   @id @default(uuid())
  businessId    String   @map("business_id")
  name          String
  fieldType     CustomFieldType @map("field_type")
  isRequired    Boolean  @default(false) @map("is_required")
  showOnInvoice Boolean  @default(false) @map("show_on_invoice")
  isSearchable  Boolean  @default(true) @map("is_searchable")
  options       Json?                        // string[] for DROPDOWN type
  sortOrder     Int      @default(0) @map("sort_order")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  values        CustomFieldValue[]

  @@unique([businessId, name])
  @@map("custom_field_defs")
}

enum CustomFieldType {
  TEXT
  NUMBER
  DATE
  DROPDOWN
}

// ─── CUSTOM FIELD VALUE ─────────────────────────────────────

model CustomFieldValue {
  id            String   @id @default(uuid())
  productId     String   @map("product_id")
  fieldDefId    String   @map("field_def_id")
  value         String                        // stored as string, parsed by fieldType
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  product       Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  fieldDef      CustomFieldDef @relation(fields: [fieldDefId], references: [id], onDelete: Cascade)

  @@unique([productId, fieldDefId])
  @@map("custom_field_values")
}

// ─── PRODUCT STOCK SETTING (per-product override) ───────────

model ProductStockSetting {
  id                    String   @id @default(uuid())
  productId             String   @unique @map("product_id")
  stockValidationMode   StockValidationMode @map("stock_validation_mode")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  // Relations
  product               Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_stock_settings")
}

// ─── INVENTORY SETTING (business-level) ─────────────────────

model InventorySetting {
  id                     String   @id @default(uuid())
  businessId             String   @unique @map("business_id")
  stockValidationMode    StockValidationMode @default(WARN_ONLY) @map("stock_validation_mode")
  skuPrefix              String   @default("PRD") @db.VarChar(10) @map("sku_prefix")
  skuAutoGenerate        Boolean  @default(true) @map("sku_auto_generate")
  skuNextCounter         Int      @default(1) @map("sku_next_counter")
  lowStockAlertEnabled   Boolean  @default(true) @map("low_stock_alert_enabled")
  lowStockAlertFrequency AlertFrequency @default(DAILY) @map("low_stock_alert_frequency")
  decimalPrecisionQty    Int      @default(2) @db.SmallInt @map("decimal_precision_qty")
  defaultCategoryId      String?  @map("default_category_id")
  defaultUnitId          String?  @map("default_unit_id")
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")

  // Relations
  business               Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@map("inventory_settings")
}

enum AlertFrequency {
  ONCE        // alert once, then suppress until restocked
  DAILY       // alert once per day if still low
  EVERY_TIME  // alert on every stock change that keeps it low
}
```

### Atomic Stock Operation — Transaction Pattern

```typescript
// This is the CRITICAL pattern. Every stock change MUST use this.
// No raw UPDATE on currentStock outside a transaction.

async function adjustStock(
  tx: PrismaTransactionClient,
  params: {
    productId: string;
    businessId: string;
    quantity: number;        // positive = in, negative = out
    type: StockMovementType;
    reason?: StockAdjustmentReason;
    customReason?: string;
    notes?: string;
    referenceType?: StockReferenceType;
    referenceId?: string;
    referenceNumber?: string;
    userId: string;
    movementDate?: Date;
  }
): Promise<{ movement: StockMovement; newStock: number }> {
  // Step 1: Lock the product row (SELECT FOR UPDATE)
  const product = await tx.$queryRaw`
    SELECT id, current_stock, min_stock_level, stock_validation
    FROM products
    WHERE id = ${params.productId}
    AND business_id = ${params.businessId}
    FOR UPDATE
  `;

  if (!product[0]) throw new NotFoundError('Product not found');

  const currentStock = Number(product[0].current_stock);
  const newStock = currentStock + params.quantity;

  // Step 2: Validate stock (if reducing)
  if (params.quantity < 0) {
    const validationMode = resolveValidationMode(
      product[0].stock_validation,
      await getBusinessValidationMode(tx, params.businessId)
    );

    if (validationMode === 'HARD_BLOCK' && newStock < 0) {
      throw new InsufficientStockError({
        productId: params.productId,
        currentStock,
        requestedQty: Math.abs(params.quantity),
        deficit: Math.abs(newStock),
      });
    }
    // WARN_ONLY: allow negative, caller handles warning
  }

  // Step 3: Update product stock (atomic)
  await tx.product.update({
    where: { id: params.productId },
    data: { currentStock: newStock },
  });

  // Step 4: Create immutable movement record
  const movement = await tx.stockMovement.create({
    data: {
      businessId: params.businessId,
      productId: params.productId,
      type: params.type,
      quantity: params.quantity,
      balanceAfter: newStock,
      reason: params.reason ?? null,
      customReason: params.customReason ?? null,
      notes: params.notes ?? null,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      referenceNumber: params.referenceNumber ?? null,
      movementDate: params.movementDate ?? new Date(),
      createdBy: params.userId,
    },
  });

  // Step 5: Check low-stock alert
  const minStock = Number(product[0].min_stock_level);
  if (minStock > 0 && newStock < minStock && newStock <= currentStock) {
    await queueLowStockAlert(tx, params.productId, params.businessId, newStock, minStock);
  }

  return { movement, newStock };
}

function resolveValidationMode(
  productMode: StockValidationMode,
  businessMode: StockValidationMode
): 'WARN_ONLY' | 'HARD_BLOCK' {
  if (productMode === 'GLOBAL') return businessMode === 'GLOBAL' ? 'WARN_ONLY' : businessMode;
  return productMode;
}
```

### IndexedDB Schema (Dexie — Offline)

```typescript
// db.ts
import Dexie, { type Table } from 'dexie';

interface ProductLocal {
  id: string;
  businessId: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  unitId: string;
  salePrice: number;
  purchasePrice: number | null;
  currentStock: number;
  minStockLevel: number;
  stockValidation: 'GLOBAL' | 'WARN_ONLY' | 'HARD_BLOCK';
  hsnCode: string | null;
  sacCode: string | null;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  customFields: Record<string, string>;  // fieldDefId → value (denormalized for speed)
  createdAt: string;
  updatedAt: string;
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _localVersion: number;
}

interface StockMovementLocal {
  id: string;
  businessId: string;
  productId: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  customReason: string | null;
  notes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  movementDate: string;
  createdBy: string;
  createdAt: string;
  _syncStatus: 'synced' | 'pending';
}

interface CategoryLocal {
  id: string;
  businessId: string;
  name: string;
  type: 'PREDEFINED' | 'CUSTOM';
  color: string | null;
  sortOrder: number;
  isHidden: boolean;
}

interface UnitLocal {
  id: string;
  businessId: string | null;
  name: string;
  symbol: string;
  type: 'PREDEFINED' | 'CUSTOM';
}

interface UnitConversionLocal {
  id: string;
  businessId: string;
  fromUnitId: string;
  toUnitId: string;
  factor: number;
}

interface CustomFieldDefLocal {
  id: string;
  businessId: string;
  name: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN';
  isRequired: boolean;
  showOnInvoice: boolean;
  isSearchable: boolean;
  options: string[] | null;
  sortOrder: number;
}

class HisaabDB extends Dexie {
  products!: Table<ProductLocal>;
  stockMovements!: Table<StockMovementLocal>;
  categories!: Table<CategoryLocal>;
  units!: Table<UnitLocal>;
  unitConversions!: Table<UnitConversionLocal>;
  customFieldDefs!: Table<CustomFieldDefLocal>;

  constructor() {
    super('hisaab-inventory');
    this.version(1).stores({
      products: 'id, businessId, [businessId+status], [businessId+categoryId], [businessId+name], [businessId+sku], _syncStatus',
      stockMovements: 'id, [productId+createdAt], [businessId+movementDate], [referenceType+referenceId], _syncStatus',
      categories: 'id, [businessId+name], businessId',
      units: 'id, [businessId+name], [businessId+symbol]',
      unitConversions: 'id, [businessId+fromUnitId+toUnitId]',
      customFieldDefs: 'id, [businessId+name]',
    });
  }
}

export const db = new HisaabDB();
```

### Offline Stock Adjustment (Dexie transaction)

```typescript
async function adjustStockOffline(params: {
  productId: string;
  quantity: number;    // positive = in, negative = out
  type: StockMovementType;
  reason?: string;
  userId: string;
}): Promise<void> {
  await db.transaction('rw', db.products, db.stockMovements, async () => {
    const product = await db.products.get(params.productId);
    if (!product) throw new Error('Product not found');

    const newStock = product.currentStock + params.quantity;

    // Validation (same logic as server)
    if (params.quantity < 0) {
      const mode = resolveValidationModeLocal(product);
      if (mode === 'HARD_BLOCK' && newStock < 0) {
        throw new InsufficientStockError({ ... });
      }
    }

    // Atomic: update stock + create movement
    await db.products.update(params.productId, {
      currentStock: newStock,
      updatedAt: new Date().toISOString(),
      _syncStatus: 'pending',
      _localVersion: product._localVersion + 1,
    });

    await db.stockMovements.add({
      id: crypto.randomUUID(),
      businessId: product.businessId,
      productId: params.productId,
      type: params.type,
      quantity: params.quantity,
      balanceAfter: newStock,
      reason: params.reason ?? null,
      customReason: null,
      notes: null,
      referenceType: 'ADJUSTMENT',
      referenceId: null,
      referenceNumber: null,
      movementDate: new Date().toISOString(),
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
      _syncStatus: 'pending',
    });
  });
}
```

### Sync Strategy

```
Offline changes queue → On reconnect:
  1. Push pending StockMovements to server (ordered by movementDate)
  2. Server replays each movement in a transaction (SELECT FOR UPDATE)
  3. If conflict (stock went negative due to other device):
     - WARN_ONLY mode: accept, stock goes negative, flag for review
     - HARD_BLOCK mode: reject movement, notify user "Stock conflict on [Product]"
  4. Pull server state → update local IndexedDB
  5. balanceAfter recalculated server-side (local balanceAfter is approximate)
```

---

## 6. UI States

### 6.1 Product List

| State | Content |
|-------|---------|
| **Empty** | Illustration + "No products yet" + "Add your first product" CTA |
| **Loading** | Skeleton cards (3 rows) |
| **Populated** | Product cards in list view. Each card: name, SKU, sale price, stock (color-coded: green > min, yellow = near min, red < min) |
| **Search active** | Search bar expanded, real-time filter, "No results for [X]" if empty |
| **Filtered** | Active filter chips shown below search bar (e.g. "Category: Electronics", "Low stock only"). "Clear all" link |
| **Error** | "Could not load products. Retry?" with retry button |
| **Offline** | Normal display from IndexedDB + "Offline" banner. All CRUD works |

### 6.2 Product Form (Create / Edit)

| State | Content |
|-------|---------|
| **Create** | Empty form, auto-focus on product name. SKU auto-generate toggle ON. "Add Product" button |
| **Edit** | Pre-filled form. "Opening stock" field hidden (cannot change). "Save Changes" button |
| **Saving** | Button shows spinner + "Saving..." — form fields disabled |
| **Validation error** | Inline red text below invalid fields. Form does NOT scroll to top — highlights first error |
| **SKU conflict** | Red text: "SKU already exists" below SKU field |
| **Success** | Toast: "Product added" / "Product updated". Bottom sheet: "Add another" / "Done" |

### 6.3 Stock Adjustment

| State | Content |
|-------|---------|
| **Initial** | Shows current stock prominently. Toggle: Stock In / Stock Out. Quantity field auto-focused |
| **Reason selected** | Reason dropdown filled. If "Other" → custom reason text field appears |
| **Warning (negative stock)** | Yellow banner: "Stock will go to -5 pcs. This product allows negative stock." + Continue/Cancel |
| **Blocked (insufficient)** | Red banner: "Cannot reduce stock below 0. Current: 45, Requested: 50" + OK button (no continue) |
| **Saving** | Button spinner |
| **Success** | Toast with new stock: "Stock adjusted. New stock: 40 pcs" |

### 6.4 Low-Stock Alerts

| State | Content |
|-------|---------|
| **No low-stock items** | Widget hidden from dashboard (or greyed: "All stock levels OK") |
| **Items below minimum** | Dashboard widget: red badge with count. Card: "3 items low on stock" + "View all" |
| **Alert list** | Full-screen list. Each row: product name, current qty (red), min level, deficit. Tap → product detail |
| **Push notification** | "[Business]: 3 items below minimum stock. Tap to view." |

### 6.5 Category Manager

| State | Content |
|-------|---------|
| **List** | Two sections: "Predefined" (with hide/show toggles) + "Custom" (with edit/delete). Drag handles for reorder |
| **Add** | Bottom sheet: name input + color picker. "Save" button |
| **Delete** | Confirmation dialog: "Move [X] products to:" + category dropdown + "Delete" |
| **Empty custom** | "No custom categories. Add one?" |

### 6.6 Unit & Conversion Manager

| State | Content |
|-------|---------|
| **Units list** | Two sections: Predefined (read-only) + Custom (editable). Each shows product count using it |
| **Conversions list** | Each row: "1 box = 12 pcs" with edit/delete. "Add Conversion" button |
| **Add conversion** | Two dropdowns (from/to) + factor input. Live preview: "1 [from] = [factor] [to]" |
| **Delete unit error** | "Cannot delete: 5 products use this unit. Reassign them first." |

### 6.7 Custom Fields Manager

| State | Content |
|-------|---------|
| **List** | Each field: name, type badge, required/optional tag, "Show on invoice" toggle |
| **Add** | Bottom sheet: name, type dropdown, required toggle, show-on-invoice toggle. If DROPDOWN → options list with +/- |
| **On product form** | Custom fields rendered dynamically below standard fields. Type-appropriate inputs |

---

## 7. Mobile

### 7.1 Product Entry on 375px (iPhone SE)

```
┌─────────────────────────────┐
│ ←  Add Product              │  ← sticky header
├─────────────────────────────┤
│                             │
│  Product Name *             │
│  ┌─────────────────────────┐│
│  │ Maggi Noodles           ││  ← auto-focus, keyboard opens
│  └─────────────────────────┘│
│                             │
│  SKU  ☑ Auto-generate       │
│  ┌─────────────────────────┐│
│  │ PRD-0001        (grey)  ││  ← disabled when auto
│  └─────────────────────────┘│
│                             │
│  ┌────────────┐┌───────────┐│
│  │ Category ▼ ││ Unit ▼    ││  ← side-by-side dropdowns
│  │ Grocery    ││ pcs       ││
│  └────────────┘└───────────┘│
│                             │
│  ┌────────────┐┌───────────┐│
│  │ Sale Price ││ Purchase  ││  ← side-by-side, numeric keyboard
│  │ ₹ 14.00   ││ ₹ 12.00   ││
│  └────────────┘└───────────┘│
│                             │
│  ▸ Stock Info               │  ← collapsible, open by default
│  ┌────────────┐┌───────────┐│
│  │ Opening    ││ Min Level ││
│  │ 100        ││ 20        ││
│  └────────────┘└───────────┘│
│                             │
│  ▸ Additional Info          │  ← collapsed by default
│  ▸ Custom Fields            │  ← collapsed, only if fields exist
│                             │
├─────────────────────────────┤
│  [ Add Product ]            │  ← sticky bottom, full-width CTA
└─────────────────────────────┘
```

**Mobile-specific behaviors:**
- Numeric keyboard for all price/qty fields (`inputMode="decimal"`)
- Category and Unit dropdowns use native select on mobile (no custom dropdown)
- Collapsible sections reduce scroll on small screens
- "Add Product" button is sticky at bottom, always visible
- Form saves to local state on every keypress (survives accidental back navigation)

### 7.2 Stock Adjustment Flow (375px)

```
┌─────────────────────────────┐
│ ←  Adjust Stock             │
├─────────────────────────────┤
│                             │
│  Maggi Noodles              │
│  Current Stock: 45 pcs      │  ← large, prominent
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │ + IN    │ │ - OUT   │   │  ← toggle buttons, active = filled
│  └─────────┘ └─────────┘   │
│                             │
│  Quantity *                 │
│  ┌─────────────────────────┐│
│  │ 5                       ││  ← numeric keyboard
│  └─────────────────────────┘│
│  New stock will be: 40 pcs  │  ← live preview
│                             │
│  Reason *                   │
│  ┌─────────────────────────┐│
│  │ Damage              ▼  ││
│  └─────────────────────────┘│
│                             │
│  Notes (optional)           │
│  ┌─────────────────────────┐│
│  │                         ││
│  └─────────────────────────┘│
│                             │
├─────────────────────────────┤
│  [ Save Adjustment ]        │  ← sticky bottom
└─────────────────────────────┘
```

### 7.3 Search & Filter (375px)

```
┌─────────────────────────────┐
│ 🔍 Search products...    ⚙  │  ← tap opens full search
├─────────────────────────────┤
│ [Grocery ✕] [Low stock ✕]  │  ← active filter chips, scrollable horizontal
├─────────────────────────────┤
│ ┌───────────────────────┐   │
│ │ Maggi Noodles         │   │
│ │ PRD-0001 · ₹14 · 45🟢│   │  ← green dot = stock OK
│ └───────────────────────┘   │
│ ┌───────────────────────┐   │
│ │ Atta (5kg bag)        │   │
│ │ PRD-0002 · ₹250 · 3🔴│   │  ← red dot = below minimum
│ └───────────────────────┘   │
│ ┌───────────────────────┐   │
│ │ Rice (1kg)            │   │
│ │ PRD-0003 · ₹65 · 12🟡│   │  ← yellow = approaching minimum
│ └───────────────────────┘   │
│        ... virtual scroll   │
└─────────────────────────────┘

Filter bottom sheet (on ⚙ tap):
┌─────────────────────────────┐
│ Filter Products         ✕   │
├─────────────────────────────┤
│ Category                    │
│ ○ All  ● Grocery  ○ Elec.  │  ← chip select
│                             │
│ Stock Status                │
│ ○ All  ○ In Stock  ● Low   │
│                             │
│ Status                      │
│ ○ All  ● Active  ○ Inactive│
│                             │
│ Sort By                     │
│ ● Name  ○ Price  ○ Stock   │
│ ○ Ascending  ● Descending  │
│                             │
│ [ Apply Filters ]           │
└─────────────────────────────┘
```

### 7.4 Performance Targets (Mobile)

| Action | Target | How |
|--------|--------|-----|
| Product list render | < 100ms for 500 products | Virtual scrolling (react-window), IndexedDB query |
| Search/filter | < 50ms response | IndexedDB compound index, debounce 200ms |
| Product form open | < 150ms | Lazy-load custom fields section |
| Stock adjustment save | < 200ms (local) | Dexie transaction, async sync |
| Unit conversion calc | < 10ms | In-memory lookup table, cached on app start |

---

## 8. Edge Cases

### 8.1 Negative Stock

| Scenario | Warn-Only Mode | Hard-Block Mode |
|----------|---------------|-----------------|
| Sale invoice reduces stock below 0 | Allow with warning banner on invoice. Stock goes negative. | Block save. "Insufficient stock for [Product]. Available: X, Requested: Y" |
| Manual adjustment reduces below 0 | Allow with confirmation dialog | Block with error message |
| Offline sale + stock already sold on another device | Accept locally. On sync: server accepts (warn mode) or rejects (hard block) and notifies user |
| Concurrent sales from 2 devices (same product) | `SELECT FOR UPDATE` prevents race condition server-side. Second request sees updated stock | Same — second request blocked if stock insufficient |

### 8.2 Unit Conversion Rounding

```
Rule: All stock stored in base unit with 3 decimal precision.
Conversion uses ROUND_HALF_UP to 3 decimals.

Example:
  Product: "Wire" stored in meters
  Conversion: 1 ft = 0.3048 meters
  Sale: 10 ft
  Stock deducted: 10 × 0.3048 = 3.048 meters (exact, no rounding needed)

  Conversion: 1 kg = 1000 gm
  Product stored in kg
  Sale: 1500 gm = 1.500 kg deducted

Edge case:
  1 dozen = 12 pcs
  Sale: 0.5 dozen = 6 pcs (exact)
  Sale: 0.33 dozen = 3.96 pcs → WARN: "0.33 dozen = 3.96 pcs. Round to 4 pcs?"

  Rule: If conversion results in fractional base units for a discrete unit (pcs, box),
        show warning and let user confirm or adjust quantity.
```

### 8.3 Bulk Product Import (Future — Phase 4, but schema supports it now)

```
Import scenarios handled by current schema:
  - Duplicate SKU → reject row, show in error report
  - Duplicate name → warn, allow (names are not unique)
  - Missing required field → reject row
  - Unknown category → create new category
  - Unknown unit → reject row (units must exist)
  - Opening stock → creates StockMovement(type: OPENING)
```

### 8.4 Duplicate SKU Prevention

```
Uniqueness: @@unique([businessId, sku])
  - Auto-generated: uses InventorySetting.skuNextCounter, atomically incremented
  - Manual: validated before save, unique per business
  - Null allowed (multiple products can have no SKU)
  - Offline: local counter, collision resolved on sync:
      1. Server detects conflict
      2. Generates new SKU for conflicting product
      3. Notifies user: "SKU PRD-0005 was reassigned to PRD-0006 due to conflict"
```

### 8.5 Category / Unit Deletion with Dependencies

```
Category deletion:
  - Must reassign all products to another category (required in API)
  - Predefined categories: can only hide, never delete

Unit deletion:
  - Blocked if any product uses it
  - Blocked if any UnitConversion references it
  - Error: "Cannot delete [unit]. Used by X products. Reassign products first."

Custom field deletion:
  - Deletes all CustomFieldValues (cascade)
  - Confirmation: "This will remove [field] from all X products. Continue?"
```

### 8.6 Stock Recalculation (Disaster Recovery)

```
If stock ever becomes inconsistent (bug, data corruption):
  Admin endpoint: POST /admin/products/:id/recalculate-stock

  Logic:
    1. Sum all StockMovement.quantity for this product
    2. Compare with Product.currentStock
    3. If mismatch: create ADJUSTMENT movement for difference, update currentStock
    4. Log to audit trail

  This is a manual admin action, never runs automatically.
```

### 8.7 Invoice Edit → Stock Reversal

```
When an existing invoice is edited (line item qty changes):
  1. Reverse all stock movements for that invoice (create REVERSAL movements)
  2. Apply new stock movements for updated line items
  3. All within single transaction

When invoice is deleted:
  1. Create REVERSAL movements for all line items
  2. Stock restored to pre-invoice levels
  3. Deletion reason logged

When invoice is voided (not deleted):
  1. Same as delete — REVERSAL movements created
  2. Invoice remains in system with VOID status
```

---

## 9. Constraints

### Business Limits (per subscription tier)

| Constraint | Free | Pro | Business |
|-----------|------|-----|----------|
| Max products | 50 | 500 | Unlimited |
| Max categories | 5 custom + predefined | 50 | Unlimited |
| Max custom fields | 3 | 10 | Unlimited |
| Max unit conversions | 5 | 20 | Unlimited |
| Stock movement history | 90 days | 1 year | Unlimited |
| Bulk import | Not available | 500 rows | Unlimited |

### Performance Constraints

| Constraint | Target | Implementation |
|-----------|--------|---------------|
| Product search response | < 200ms (server) | PostgreSQL GIN index on name, full-text search |
| Product list page load | < 300ms | Paginated (20/page), IndexedDB for offline |
| Stock adjustment (server) | < 100ms | Single transaction, row-level lock |
| Unit conversion calculation | < 5ms | In-memory cache, preloaded on login |
| Low-stock query | < 200ms | Composite index: [businessId, currentStock, minStockLevel] |
| Product count per business | Tested up to 10,000 | Virtual scrolling in UI, indexed queries in DB |

### Stock Calculation Precision

| Field | Precision | Rationale |
|-------|-----------|-----------|
| currentStock | Decimal(12,3) | Supports 999,999,999.999 — handles kg, ltr fractions |
| quantity (movement) | Decimal(12,3) | Matches stock precision |
| salePrice / purchasePrice | Decimal(12,2) | Indian Rupees, 2 decimal (paise) |
| conversionFactor | Decimal(15,6) | High precision for inverse conversions (1/3 = 0.333333) |
| balanceAfter | Decimal(12,3) | Snapshot of stock after movement |

### Offline Constraints

| Constraint | Rule |
|-----------|------|
| SKU auto-generation offline | Uses local counter with format `{prefix}-{localCounter}-L` (L = local). Resolved on sync |
| Stock movements offline | Stored locally, synced in chronological order. Server recalculates balanceAfter |
| Concurrent offline edits | Last-write-wins for product fields. Stock movements are append-only (never conflict) |
| Maximum offline duration | Tested for 7 days. Sync handles up to 10,000 pending movements |

---

## 10. Out of Scope

These features are explicitly NOT part of this PRD. They are planned for later phases.

| Feature | Phase | Reason |
|---------|-------|--------|
| **Barcode generation/scanning** | Phase 4 (#105-106) | Requires camera integration, adds complexity to MVP |
| **Batch tracking (MFD/expiry)** | Phase 4 (#107) | Adds batch dimension to every stock operation |
| **Serial number tracking** | Phase 4 (#108) | Requires per-unit tracking, not per-qty |
| **Multi-godown / warehouse** | Phase 4 (#109) | Adds location dimension to stock — major schema change |
| **Stock adjustment (advanced)** | Phase 4 (#110) | This PRD covers basic adjustment. Phase 4 adds inter-godown transfer |
| **Label printing** | Phase 4 (#111) | Depends on barcode generation |
| **Bulk import/export** | Phase 4 (#112) | This PRD's schema supports it, but UI/import logic is Phase 4 |
| **Expiry alerts** | Phase 4 (#113) | Depends on batch tracking |
| **Reorder points / auto-PO** | Phase 4 (#114) | Depends on Purchase Order module |
| **Item conversion (BOM)** | Phase 4 (#115) | Manufacturing — bill of materials |
| **Item images** | Phase 4 (#116) | File upload infrastructure, CDN |
| **GST tax calculation** | Phase 2 (#63) | HSN/SAC stored now, tax engine comes in Phase 2 |
| **Party-wise pricing** | 1B (#16) | Handled by Party Management module, not Inventory |
| **Product-level discounts** | 1C (#18) | Handled at invoice line-item level |

---

## 11. Build Plan

### Phase Breakdown

| Step | Task | Estimate | Dependencies |
|------|------|----------|-------------|
| **S1** | Database: Prisma schema for all inventory models + migration | 0.5 day | None |
| **S2** | Seed: Predefined categories (10) + predefined units (19) | 0.5 day | S1 |
| **S3** | Backend: Category CRUD API + Zod validation | 0.5 day | S1 |
| **S4** | Backend: Unit CRUD + UnitConversion CRUD API | 0.5 day | S1 |
| **S5** | Backend: Product CRUD API (create, read, update, soft-delete) | 1 day | S1, S3, S4 |
| **S6** | Backend: Stock adjustment API + atomic transaction pattern | 1 day | S5 |
| **S7** | Backend: Stock validation endpoint (pre-invoice check) | 0.5 day | S6 |
| **S8** | Backend: StockService internal functions (deductForSaleInvoice, addForPurchaseInvoice, reverseForInvoice) | 1 day | S6 |
| **S9** | Backend: Inventory settings API | 0.5 day | S1 |
| **S10** | Backend: Custom field defs CRUD + custom field values on product | 0.5 day | S5 |
| **S11** | Backend: Low-stock alert trigger + notification queue integration | 0.5 day | S6, Notification module |
| **S12** | Backend: SKU auto-generation (with atomic counter) | 0.5 day | S5, S9 |
| **S13** | Frontend: IndexedDB schema (Dexie) for all inventory tables | 0.5 day | None |
| **S14** | Frontend: Product list page (search, filter, sort, virtual scroll) | 1 day | S13 |
| **S15** | Frontend: Product form (create + edit, with custom fields) | 1 day | S13, S14 |
| **S16** | Frontend: Stock adjustment UI + validation flow | 0.5 day | S13 |
| **S17** | Frontend: Category manager (settings page) | 0.5 day | S13 |
| **S18** | Frontend: Unit & conversion manager (settings page) | 0.5 day | S13 |
| **S19** | Frontend: Custom fields manager (settings page) | 0.5 day | S13 |
| **S20** | Frontend: Low-stock dashboard widget + alert list | 0.5 day | S13 |
| **S21** | Frontend: Inventory settings page | 0.25 day | S13 |
| **S22** | Offline: Sync logic for products + stock movements + conflict resolution | 1 day | S13, S5, S6 |
| **S23** | Integration: Wire stock deduction into Sale Invoice save flow | 0.5 day | S8, Invoicing module |
| **S24** | Integration: Wire stock addition into Purchase Invoice save flow | 0.5 day | S8, Invoicing module |
| **S25** | Integration: Stock validation warning/block in invoice form | 0.5 day | S7, Invoicing module |
| **S26** | Testing: Unit tests for atomic stock operations, conversion math, validation | 1 day | S6, S7, S8 |
| **S27** | Testing: Integration tests for invoice → stock flow | 0.5 day | S23, S24 |
| **S28** | Testing: Offline sync tests (conflict scenarios) | 0.5 day | S22 |

### Total: ~16.5 days (3.3 weeks)

### Suggested Order (critical path)

```
Week 1: S1 → S2 → S3 + S4 (parallel) → S5 → S6
Week 2: S7 + S8 + S9 + S10 + S11 + S12 (backend complete) → S13 → S14 + S15
Week 3: S16-S21 (frontend) → S22 (offline) → S23-S25 (integration) → S26-S28 (testing)
```

### Build Principles

1. **Backend first** — APIs complete and tested before frontend starts
2. **Atomic stock operations from day 1** — no "quick hack now, fix later"
3. **Offline from day 1** — every UI operation goes through IndexedDB first
4. **Mobile-first** — every screen designed at 375px, then scales up
5. **No invoice coupling in schema** — Invoice module calls StockService, not the other way around

---

## 12. Acceptance Criteria

### Feature 1: Products CRUD

- [ ] Can create product with all fields (name, SKU, price, unit, category, stock, HSN)
- [ ] SKU auto-generates as `{prefix}-{counter}` when toggle is ON
- [ ] SKU uniqueness enforced per business (server + client)
- [ ] Can search products by name, SKU, description (< 200ms response)
- [ ] Can filter by category, status, low-stock
- [ ] Can sort by name, sale price, purchase price, stock, date created
- [ ] Can edit all fields except opening stock
- [ ] Soft-delete sets status to INACTIVE (never hard-deletes products with invoices)
- [ ] Product list renders 500 products with virtual scrolling, no jank
- [ ] Works offline: CRUD operations saved to IndexedDB, synced on reconnect

### Feature 2: Stock In/Out

- [ ] Sale invoice save atomically deducts stock (server: SELECT FOR UPDATE, client: Dexie transaction)
- [ ] Purchase invoice save atomically adds stock
- [ ] Manual stock adjustment with required reason
- [ ] Every stock change creates immutable StockMovement record
- [ ] Stock movement log shows: who, when, qty, reason, reference invoice
- [ ] Invoice edit reverses old movements, applies new ones (single transaction)
- [ ] Invoice delete restores stock via REVERSAL movements
- [ ] Two simultaneous sales from different devices: no race condition, no double-deduction
- [ ] Offline stock adjustments sync correctly, server recalculates balanceAfter

### Feature 3: Stock Validation

- [ ] Global setting: WARN_ONLY or HARD_BLOCK (default: WARN_ONLY)
- [ ] Per-product override: GLOBAL (use business setting), WARN_ONLY, HARD_BLOCK
- [ ] WARN_ONLY: shows yellow warning, allows save
- [ ] HARD_BLOCK: shows red error, prevents save
- [ ] Pre-validation endpoint validates all line items before invoice save
- [ ] Warning/block message shows: product name, current stock, requested qty, deficit

### Feature 4: Low-Stock Alerts

- [ ] Products with currentStock < minStockLevel flagged
- [ ] Dashboard widget shows count + "View all" link
- [ ] Push notification sent based on frequency setting (once/daily/every time)
- [ ] Alert list: sorted by deficit, filterable by category
- [ ] In-app badge on Products tab when low-stock items exist
- [ ] Alert suppressed after restock above minimum (until next drop)

### Feature 5: Item Categories & Units

- [ ] 10 predefined categories seeded on business creation (cannot delete, can hide)
- [ ] Custom categories: create, edit, delete (with product reassignment)
- [ ] Category names unique per business
- [ ] 19 predefined units seeded (cannot delete)
- [ ] Custom units: create, edit, delete (blocked if products reference it)
- [ ] Unit conversions: define factor, auto-creates reverse direction
- [ ] During billing: user selects alternative unit, system converts to base unit for stock
- [ ] Price auto-converts when unit changes (e.g. Rs 5/pcs → Rs 60/box if 1 box = 12 pcs)
- [ ] Fractional discrete unit warning (e.g. "0.33 dozen = 3.96 pcs — round?")

### Feature 6: Item Custom Fields

- [ ] Define custom fields: TEXT, NUMBER, DATE, DROPDOWN types
- [ ] DROPDOWN: define options list
- [ ] Fields appear on product form (dynamically rendered)
- [ ] Fields searchable in product search (when isSearchable = true)
- [ ] Fields optionally visible on invoice (when showOnInvoice = true)
- [ ] Deleting field definition removes all values (with confirmation)
- [ ] Custom field values survive product edit (not wiped on update)

### Cross-Cutting

- [ ] All operations work offline with full fidelity
- [ ] Sync queue processes in order, handles conflicts gracefully
- [ ] All screens render correctly at 375px width
- [ ] All price fields use INR formatting (Rs / ₹ with commas: 1,00,000.00)
- [ ] All stock fields respect decimalPrecisionQty setting
- [ ] Subscription tier limits enforced (max products, categories, custom fields)
- [ ] Audit trail: every create/update/delete logged with user and timestamp

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Prisma schema validated (no missing fields, correct types)
- [ ] API contract validated (all CRUD covered, proper error codes)
- [ ] Mobile wireframes validated at 375px
- [ ] Atomic stock pattern reviewed for correctness
- [ ] Offline sync strategy reviewed
- [ ] Edge cases reviewed and accepted
- [ ] Build plan timeline accepted
