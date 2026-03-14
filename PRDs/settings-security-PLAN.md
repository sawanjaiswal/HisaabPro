# Mission Plan: Settings & Security | Status: Awaiting Approval

> **PRD #8** | **Phase:** 1H (MVP) | **Features:** #56-#62
> **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal
> **Depends on:** Auth (#1), Onboarding (#10), Party CRUD (#11), Sale Invoice (#18)
> **Competitor gap:** #1 Vyapar complaint — rigid preset roles, no custom permissions

---

## 1. What

Seven features that give business owners full control over who can do what, protect sensitive data, and add quality-of-life tools:

| # | Feature | Complexity | Why It Matters |
|---|---------|-----------|----------------|
| 56 | Custom User Roles/Permissions | MEDIUM | #1 competitor complaint — Vyapar has 3 rigid roles, we have unlimited custom |
| 57 | Transaction Edit/Delete Controls | LOW | Staff change prices, delete invoices — owners lose money |
| 58 | Passcode / PIN Protection | LOW | Shared phones in India — anyone can open the app |
| 59 | Biometric Auth | LOW | Faster unlock for owners who want security without friction |
| 60 | Date Format Customization | LOW | Indian default DD/MM/YYYY, but exporters need ISO |
| 61 | Keyboard Shortcuts for Billing | LOW | Power users on tablets/desktops bill 2x faster |
| 62 | Built-in Calculator | LOW | Every counter has a calculator — put it inside the app |

**Core principle:** Everything works offline. Roles, permissions, PIN, settings — all cached in IndexedDB. Server is source of truth, but the app never blocks on network for security checks.

---

## 2. Domain Model

```
┌─────────────────────────────────────────────────────────────┐
│                        Business                              │
│  (owner creates roles, invites staff, sets security policy)  │
└──────┬──────────────────────────────────────────────────┬────┘
       │                                                  │
       ▼                                                  ▼
┌──────────────┐    has many    ┌──────────────────────────┐
│     Role     │◄──────────────►│     Permission           │
│              │                │  (module + action + field)│
│ - name       │                │                          │
│ - isDefault  │                │  e.g. invoicing.create   │
│ - isSystem   │                │  e.g. inventory.view     │
│ - priority   │                │  e.g. field.purchasePrice│
└──────┬───────┘                └──────────────────────────┘
       │
       │ assigned to
       ▼
┌──────────────┐         ┌──────────────────────┐
│   UserRole   │────────►│       User           │
│  (junction)  │         │  (staff member)      │
│ - assignedBy │         │  - phone             │
│ - assignedAt │         │  - pin (hashed)      │
│              │         │  - biometricEnabled  │
└──────────────┘         └──────────┬───────────┘
                                    │
                                    │ performs
                                    ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│  TransactionLock     │    │       AuditLog               │
│  - lockAfterDays     │    │  - action (CREATE/UPDATE/DEL)│
│  - approvalRequired  │    │  - entityType + entityId     │
│  - priceThreshold    │    │  - beforeSnapshot (JSON)     │
│  - overridePin       │    │  - afterSnapshot (JSON)      │
└──────────────────────┘    │  - reason                    │
                            │  - ipAddress                 │
                            └──────────────────────────────┘

┌──────────────────────┐
│    AppSettings       │
│  - dateFormat        │
│  - pinEnabled        │
│  - pinHash           │
│  - biometricEnabled  │
│  - operationPinHash  │
│  - calculatorPosition│
│  - shortcuts (JSON)  │
└──────────────────────┘
```

### Entity Relationships

| Entity | Cardinality | Notes |
|--------|-------------|-------|
| Business → Role | 1:N | Each business creates its own roles |
| Role → Permission | M:N | Via RolePermission junction. One role has many permissions. |
| User → Role | M:N | Via UserRole. A user can have multiple roles (permissions merge with OR logic). |
| Business → TransactionLockConfig | 1:1 | One config per business |
| User → AuditLog | 1:N | Every mutation logged |
| User → AppSettings | 1:1 | Per-device settings (PIN, biometric, date format) |

---

## 3. User Flows

### Flow 1: Create Custom Role

```
Settings → Staff & Roles → "Create Role"
    │
    ├─→ Enter role name (e.g., "Billing Staff", "Godown Manager")
    │
    ├─→ Permission Matrix (grouped by module)
    │       │
    │       ├─→ [Module: Invoicing]
    │       │       ├─→ ☑ View invoices
    │       │       ├─→ ☑ Create invoices
    │       │       ├─→ ☐ Edit invoices
    │       │       ├─→ ☐ Delete invoices
    │       │       └─→ ☐ Share invoices
    │       │
    │       ├─→ [Module: Inventory]
    │       │       ├─→ ☑ View stock
    │       │       ├─→ ☐ Add products
    │       │       ├─→ ☐ Edit products
    │       │       ├─→ ☐ Delete products
    │       │       └─→ ☐ Adjust stock
    │       │
    │       ├─→ [Module: Payments]
    │       │       ├─→ ☑ View payments
    │       │       ├─→ ☑ Record payment
    │       │       ├─→ ☐ Edit payment
    │       │       └─→ ☐ Delete payment
    │       │
    │       ├─→ [Module: Parties]
    │       │       ├─→ ☑ View parties
    │       │       ├─→ ☑ Add parties
    │       │       ├─→ ☐ Edit parties
    │       │       ├─→ ☐ Delete parties
    │       │       └─→ ☐ Import contacts
    │       │
    │       ├─→ [Module: Reports]
    │       │       ├─→ ☑ View reports
    │       │       ├─→ ☐ Download reports
    │       │       └─→ ☐ Share reports
    │       │
    │       ├─→ [Module: Settings]
    │       │       ├─→ ☐ View settings
    │       │       ├─→ ☐ Modify settings
    │       │       └─→ ☐ Manage staff
    │       │
    │       └─→ [Module: Sensitive Fields]
    │               ├─→ ☐ View purchase price
    │               ├─→ ☐ View profit margin
    │               ├─→ ☐ View party phone number
    │               └─→ ☐ View party outstanding
    │
    ├─→ [Optional] Start from template
    │       ├─→ "Clone from: Manager" → pre-fill, then customize
    │       └─→ "Start blank" → all unchecked
    │
    ├─→ "Save Role"
    │       ├─→ Saved to server + cached in IndexedDB
    │       └─→ Toast: "Role 'Billing Staff' created"
    │
    └─→ [BRANCH] Offline?
            └─→ Saved locally → synced when online
```

### Flow 2: Invite Staff Member

```
Settings → Staff & Roles → "Invite Staff"
    │
    ├─→ Enter staff name
    ├─→ Enter phone number (Indian 10-digit, validated)
    │
    ├─→ Assign role (dropdown — shows all roles including custom)
    │       ├─→ Owner (cannot assign — only 1 per business)
    │       ├─→ Manager
    │       ├─→ Billing Staff
    │       ├─→ Viewer
    │       └─→ [Custom roles...]
    │
    ├─→ "Send Invite"
    │       ├─→ WhatsApp message sent: "You've been invited to [Business] on HisaabApp.
    │       │    Download: [link]. Your access code: [6-digit code]. Valid for 48 hours."
    │       ├─→ SMS fallback if WhatsApp fails
    │       └─→ Invite record created: status = PENDING
    │
    ├─→ Staff receives invite
    │       ├─→ Downloads app (if new) → signup with phone → enters access code
    │       ├─→ Already has app → enters access code in "Join Business" screen
    │       └─→ Linked → status = ACTIVE → appears in staff list
    │
    ├─→ [BRANCH] Invite expired (48h)?
    │       └─→ Owner can "Resend Invite" → new code generated
    │
    ├─→ [BRANCH] Phone already in business?
    │       └─→ Error: "[Name] is already a member of this business"
    │
    └─→ [BRANCH] Staff already on another business?
            └─→ Allowed — one user can be staff in multiple businesses
```

### Flow 3: Set PIN / Biometric

```
[During onboarding OR Settings → Security]
    │
    ├─→ "Set App PIN"
    │       ├─→ Enter 4-6 digit PIN
    │       ├─→ Confirm PIN (re-enter)
    │       ├─→ [BRANCH] PINs don't match → "PINs don't match. Try again."
    │       ├─→ [BRANCH] Weak PIN (1234, 0000, 1111) → Warning: "This PIN is too simple. Use a stronger PIN."
    │       ├─→ PIN saved (hashed with bcrypt, stored locally + server)
    │       └─→ Toast: "App PIN set. You'll need it every time you open the app."
    │
    ├─→ "Set Operation PIN" (separate from app PIN)
    │       ├─→ Same flow as app PIN
    │       ├─→ Used for: approving deletes, editing locked transactions, overriding locks
    │       └─→ Only owner can set/change this
    │
    ├─→ "Enable Biometric"
    │       ├─→ Check: device supports biometric? (Capacitor BiometricAuth plugin)
    │       │       ├─→ Yes → "Use fingerprint/face to unlock?" → Enable
    │       │       └─→ No → "Your device doesn't support biometric authentication"
    │       ├─→ Test biometric → success → enabled
    │       └─→ Biometric works alongside PIN (either unlocks app)
    │
    └─→ App Launch Flow
            │
            ├─→ PIN enabled + Biometric enabled?
            │       ├─→ Show biometric prompt first
            │       ├─→ Biometric success → app unlocked
            │       ├─→ Biometric fails → "Use PIN instead" button
            │       └─→ PIN entered → app unlocked
            │
            ├─→ PIN enabled only?
            │       └─→ Show PIN pad → enter PIN → app unlocked
            │
            ├─→ Neither enabled?
            │       └─→ App opens directly
            │
            └─→ [BRANCH] 5 failed PIN attempts
                    ├─→ Lockout: "Too many attempts. Try again in 30 minutes."
                    ├─→ Timer shown on screen
                    ├─→ After 30 min → 5 more attempts
                    └─→ [BRANCH] Forgot PIN?
                            ├─→ "Forgot PIN?" → OTP to registered phone
                            ├─→ Verify OTP → reset PIN
                            └─→ Audit log: "PIN reset via OTP by [user] at [time]"
```

### Flow 4: Lock Transactions

```
Settings → Security → Transaction Controls
    │
    ├─→ "Lock transactions older than"
    │       ├─→ Options: 7 days / 15 days / 30 days / Never
    │       ├─→ Default: Never (owner enables when ready)
    │       └─→ When locked: edit/delete buttons disabled, shows "Locked 🔒"
    │
    ├─→ "Require approval for"
    │       ├─→ ☑ Editing saved invoices (default: off)
    │       ├─→ ☑ Deleting any transaction (default: off)
    │       ├─→ ☑ Price changes beyond [X]% (default: off, threshold configurable)
    │       └─→ ☑ Discount beyond [X]% (default: off, threshold configurable)
    │
    ├─→ When a locked/approval-required action is attempted:
    │       ├─→ Staff sees: "This action requires owner approval"
    │       │       ├─→ [Option A] Enter operation PIN (if staff knows it)
    │       │       └─→ [Option B] "Request Approval" → notification sent to owner
    │       │
    │       ├─→ Owner receives push notification:
    │       │       ├─→ "[Staff Name] wants to edit Invoice #123"
    │       │       ├─→ Shows: what will change (before → after)
    │       │       └─→ "Approve" / "Deny" buttons
    │       │
    │       └─→ Owner approves → staff's edit goes through → audit logged
    │           Owner denies → staff notified "Request denied"
    │
    └─→ [BRANCH] Owner needs to override lock?
            ├─→ Enter operation PIN → temporary unlock for that transaction
            ├─→ Reason required: "Why are you unlocking this?"
            └─→ Audit log: "Transaction #X unlocked by [owner]. Reason: [text]"
```

### Flow 5: Use Built-in Calculator

```
Any screen → Tap calculator FAB (bottom-right, above nav bar)
    │
    ├─→ Calculator slides up as bottom sheet (60% screen height)
    │       ├─→ Does NOT dismiss current screen (overlay)
    │       ├─→ Drag handle to resize (40% to 80%)
    │       └─→ Tap outside or swipe down to dismiss
    │
    ├─→ Calculator features:
    │       ├─→ Basic: + - × ÷ = C
    │       ├─→ Percentage: "250 + 18%" = 295
    │       ├─→ GST Quick Calc (toggle row above keypad):
    │       │       ├─→ [5%] [12%] [18%] [28%] buttons
    │       │       ├─→ Enter amount → tap GST rate → shows:
    │       │       │       Base: Rs 1,000
    │       │       │       GST (18%): Rs 180
    │       │       │       Total: Rs 1,180
    │       │       └─→ Toggle: "GST inclusive" / "GST exclusive" calculation
    │       │
    │       ├─→ History: last 10 calculations (scroll up to see)
    │       │
    │       └─→ "Paste" button → inserts result into current active input field
    │               ├─→ If on invoice qty field → pastes into qty
    │               ├─→ If on rate field → pastes into rate
    │               └─→ If no active field → copies to clipboard
    │
    └─→ [Gesture alternative] Long-press any number input field → "Open Calculator"
```

---

## 4. API Contract

### 4A. Role Management

```
# List all roles for a business
GET /api/v1/businesses/:businessId/roles
Response: {
  success: true,
  data: {
    roles: [
      {
        id: "role_abc123",
        name: "Manager",
        description: "Full access except delete and settings",
        isSystem: true,        // system roles can't be deleted
        isDefault: false,      // assigned to new staff by default
        priority: 2,           // higher = more powerful (Owner=100, custom=1-99)
        permissions: ["invoicing.view", "invoicing.create", ...],
        staffCount: 3,         // how many staff have this role
        createdAt: "2026-03-14T10:00:00Z",
        updatedAt: "2026-03-14T10:00:00Z"
      }
    ]
  }
}

# Create custom role
POST /api/v1/businesses/:businessId/roles
Body: {
  name: "Godown Manager",
  description: "Manages inventory only",
  permissions: ["inventory.view", "inventory.create", "inventory.edit", "inventory.adjust", "reports.view"],
  isDefault: false
}
Response: { success: true, data: { role: { ...created role } } }

# Update role
PUT /api/v1/businesses/:businessId/roles/:roleId
Body: {
  name: "Senior Godown Manager",
  permissions: ["inventory.view", "inventory.create", "inventory.edit", "inventory.adjust", "inventory.delete", "reports.view", "reports.download"]
}
Response: { success: true, data: { role: { ...updated role } } }

# Delete custom role (not system roles)
DELETE /api/v1/businesses/:businessId/roles/:roleId
Query: ?reassignTo=role_xyz   (required — reassign staff to another role)
Response: { success: true, data: { reassignedStaff: 2 } }
```

### 4B. Permission Matrix

```
# Get full permission matrix (all available permissions)
GET /api/v1/permissions/matrix
Response: {
  success: true,
  data: {
    modules: [
      {
        key: "invoicing",
        label: "Invoicing",
        actions: [
          { key: "view", label: "View Invoices", description: "See invoice list and details" },
          { key: "create", label: "Create Invoices", description: "Create new sale/purchase invoices" },
          { key: "edit", label: "Edit Invoices", description: "Modify saved invoices" },
          { key: "delete", label: "Delete Invoices", description: "Delete invoices (moves to recycle bin)" },
          { key: "share", label: "Share Invoices", description: "Share via WhatsApp/email/print" }
        ]
      },
      {
        key: "inventory",
        label: "Inventory",
        actions: [
          { key: "view", label: "View Stock" },
          { key: "create", label: "Add Products" },
          { key: "edit", label: "Edit Products" },
          { key: "delete", label: "Delete Products" },
          { key: "adjust", label: "Adjust Stock", description: "Manual stock corrections" }
        ]
      },
      {
        key: "payments",
        label: "Payments",
        actions: [
          { key: "view", label: "View Payments" },
          { key: "create", label: "Record Payment" },
          { key: "edit", label: "Edit Payment" },
          { key: "delete", label: "Delete Payment" }
        ]
      },
      {
        key: "parties",
        label: "Parties (Customers/Suppliers)",
        actions: [
          { key: "view", label: "View Parties" },
          { key: "create", label: "Add Parties" },
          { key: "edit", label: "Edit Parties" },
          { key: "delete", label: "Delete Parties" },
          { key: "import", label: "Import Contacts" }
        ]
      },
      {
        key: "reports",
        label: "Reports",
        actions: [
          { key: "view", label: "View Reports" },
          { key: "download", label: "Download Reports" },
          { key: "share", label: "Share Reports" }
        ]
      },
      {
        key: "settings",
        label: "Settings",
        actions: [
          { key: "view", label: "View Settings" },
          { key: "modify", label: "Modify Settings" },
          { key: "manageStaff", label: "Manage Staff & Roles" }
        ]
      },
      {
        key: "fields",
        label: "Sensitive Fields",
        actions: [
          { key: "purchasePrice", label: "View Purchase Price" },
          { key: "profitMargin", label: "View Profit Margin" },
          { key: "partyPhone", label: "View Party Phone Number" },
          { key: "partyOutstanding", label: "View Party Outstanding" },
          { key: "partyGstin", label: "View Party GSTIN" }
        ]
      }
    ]
  }
}
```

**Permission string format:** `{module}.{action}` — e.g., `invoicing.create`, `fields.purchasePrice`

**Total permissions:** 7 modules x avg 4.5 actions = 32 permissions

### 4C. Staff Invite

```
# Invite staff member
POST /api/v1/businesses/:businessId/staff/invite
Body: {
  name: "Rajesh",
  phone: "9876543210",
  roleId: "role_abc123"
}
Response: {
  success: true,
  data: {
    invite: {
      id: "inv_abc123",
      code: "482917",          // 6-digit access code
      expiresAt: "2026-03-16T10:00:00Z",  // 48 hours
      status: "PENDING",
      staffName: "Rajesh",
      staffPhone: "9876543210",
      roleName: "Billing Staff"
    }
  }
}

# Accept invite (staff side)
POST /api/v1/staff/invite/accept
Body: {
  code: "482917",
  userId: "user_xyz789"   // logged-in user's ID
}
Response: {
  success: true,
  data: {
    business: { id, name, logo },
    role: { id, name, permissions }
  }
}

# List staff
GET /api/v1/businesses/:businessId/staff
Response: {
  success: true,
  data: {
    staff: [
      {
        id: "staff_abc123",
        userId: "user_xyz789",
        name: "Rajesh",
        phone: "9876543210",
        role: { id: "role_abc123", name: "Billing Staff" },
        status: "ACTIVE",           // ACTIVE | SUSPENDED | PENDING
        lastActiveAt: "2026-03-14T15:30:00Z",
        invitedBy: "user_owner1",
        joinedAt: "2026-03-10T09:00:00Z"
      }
    ],
    pending: [
      {
        id: "inv_def456",
        name: "Suresh",
        phone: "9876543211",
        roleName: "Viewer",
        status: "PENDING",
        expiresAt: "2026-03-16T10:00:00Z"
      }
    ]
  }
}

# Update staff role
PUT /api/v1/businesses/:businessId/staff/:staffId
Body: { roleId: "role_xyz456" }
Response: { success: true, data: { staff: { ...updated } } }

# Suspend staff
POST /api/v1/businesses/:businessId/staff/:staffId/suspend
Response: { success: true }

# Remove staff
DELETE /api/v1/businesses/:businessId/staff/:staffId
Response: { success: true }

# Resend invite
POST /api/v1/businesses/:businessId/staff/invite/:inviteId/resend
Response: { success: true, data: { newCode: "591038", expiresAt: "..." } }
```

### 4D. Transaction Lock Settings

```
# Get transaction lock config
GET /api/v1/businesses/:businessId/settings/transaction-lock
Response: {
  success: true,
  data: {
    lockAfterDays: 30,                     // 7 | 15 | 30 | null (never)
    requireApprovalForEdit: true,
    requireApprovalForDelete: true,
    priceChangeThresholdPercent: 10,        // null = no threshold
    discountThresholdPercent: 15,           // null = no threshold
    operationPinSet: true                   // whether owner has set operation PIN
  }
}

# Update transaction lock config
PUT /api/v1/businesses/:businessId/settings/transaction-lock
Body: {
  lockAfterDays: 15,
  requireApprovalForEdit: true,
  requireApprovalForDelete: true,
  priceChangeThresholdPercent: 20,
  discountThresholdPercent: null
}
Response: { success: true, data: { ...updated config } }

# Request approval for locked action
POST /api/v1/businesses/:businessId/approvals
Body: {
  type: "EDIT_LOCKED_TRANSACTION",         // EDIT_LOCKED_TRANSACTION | DELETE_TRANSACTION | PRICE_OVERRIDE
  entityType: "INVOICE",
  entityId: "inv_123",
  requestedChanges: {
    field: "totalAmount",
    before: 5000,
    after: 5500,
    reason: "Customer returned 1 item"
  }
}
Response: {
  success: true,
  data: {
    approval: {
      id: "apr_abc123",
      status: "PENDING",
      requestedBy: "user_staff1",
      requestedAt: "2026-03-14T10:00:00Z"
    }
  }
}

# Owner approves/denies
PUT /api/v1/businesses/:businessId/approvals/:approvalId
Body: {
  action: "APPROVE",                        // APPROVE | DENY
  operationPin: "1234"                      // required for approval
}
Response: { success: true, data: { approval: { ...updated, status: "APPROVED" } } }

# Override lock with operation PIN (owner only)
POST /api/v1/businesses/:businessId/transactions/:transactionId/unlock
Body: {
  operationPin: "1234",
  reason: "Customer dispute, correcting amount"
}
Response: {
  success: true,
  data: {
    unlockedUntil: "2026-03-14T11:00:00Z"  // 1 hour temporary unlock
  }
}
```

### 4E. App Settings

```
# Get app settings (per user per device)
GET /api/v1/users/:userId/settings
Response: {
  success: true,
  data: {
    dateFormat: "DD/MM/YYYY",
    pinEnabled: true,
    biometricEnabled: false,
    operationPinSet: true,
    calculatorPosition: "BOTTOM_RIGHT",     // BOTTOM_RIGHT | BOTTOM_LEFT
    language: "en",
    theme: "light"
  }
}

# Update app settings
PUT /api/v1/users/:userId/settings
Body: { dateFormat: "YYYY-MM-DD" }
Response: { success: true, data: { ...updated settings } }

# Set/change app PIN
POST /api/v1/users/:userId/pin
Body: {
  currentPin: "1234",     // null if setting for first time
  newPin: "567890"
}
Response: { success: true }

# Set/change operation PIN (owner only)
POST /api/v1/businesses/:businessId/operation-pin
Body: {
  currentPin: "1234",     // null if first time
  newPin: "567890"
}
Response: { success: true }

# Verify PIN (local verification preferred, server fallback)
POST /api/v1/users/:userId/pin/verify
Body: { pin: "1234" }
Response: { success: true, data: { verified: true } }

# Reset PIN via OTP
POST /api/v1/users/:userId/pin/reset
Body: { otp: "482917", newPin: "567890" }
Response: { success: true }
```

### 4F. Audit Log

```
# Get audit log
GET /api/v1/businesses/:businessId/audit-log
Query: ?page=1&limit=50&userId=user_xyz&entityType=INVOICE&action=DELETE&from=2026-03-01&to=2026-03-14
Response: {
  success: true,
  data: {
    entries: [
      {
        id: "aud_abc123",
        action: "UPDATE",
        entityType: "INVOICE",
        entityId: "inv_123",
        entityLabel: "Invoice #INV-0042",
        userId: "user_staff1",
        userName: "Rajesh",
        changes: [
          { field: "totalAmount", before: "5000", after: "5500" },
          { field: "items[1].qty", before: "10", after: "11" }
        ],
        reason: null,
        ipAddress: "192.168.1.5",
        deviceInfo: "Android 14 / HisaabApp 1.2.0",
        createdAt: "2026-03-14T10:30:00Z"
      }
    ],
    pagination: { page: 1, limit: 50, total: 234 }
  }
}
```

### 4G. Keyboard Shortcuts

```
# Get shortcut config (client-side only — no API needed)
# Stored in localStorage, not synced to server
# Default config shipped with app:

const DEFAULT_SHORTCUTS = {
  "billing.newInvoice":    { key: "n", ctrl: true, label: "New Invoice" },
  "billing.save":          { key: "s", ctrl: true, label: "Save" },
  "billing.print":         { key: "p", ctrl: true, label: "Print" },
  "billing.addLineItem":   { key: "Enter", ctrl: false, label: "Add Line Item" },
  "billing.nextField":     { key: "Tab", ctrl: false, label: "Next Field" },
  "billing.cancel":        { key: "Escape", ctrl: false, label: "Cancel / Close" },
  "global.search":         { key: "k", ctrl: true, label: "Search" },
  "global.calculator":     { key: ".", ctrl: true, label: "Toggle Calculator" },
  "navigation.dashboard":  { key: "1", alt: true, label: "Go to Dashboard" },
  "navigation.invoices":   { key: "2", alt: true, label: "Go to Invoices" },
  "navigation.parties":    { key: "3", alt: true, label: "Go to Parties" },
  "navigation.inventory":  { key: "4", alt: true, label: "Go to Inventory" },
  "navigation.reports":    { key: "5", alt: true, label: "Go to Reports" }
}
```

---

## 5. Data Model

### Prisma Schema

```prisma
// ──────────────────────────────
// ROLES & PERMISSIONS
// ──────────────────────────────

model Role {
  id          String   @id @default(cuid())
  businessId  String
  name        String
  description String?
  isSystem    Boolean  @default(false)   // Owner, Manager, Billing Staff, Viewer — can't delete
  isDefault   Boolean  @default(false)   // auto-assigned to new staff invites
  priority    Int      @default(1)       // Owner=100, Manager=80, custom=1-99
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  permissions RolePermission[]
  userRoles   UserRole[]
  invites     StaffInvite[]

  @@unique([businessId, name])
  @@index([businessId])
}

model Permission {
  id          String   @id @default(cuid())
  module      String                     // "invoicing", "inventory", "payments", "parties", "reports", "settings", "fields"
  action      String                     // "view", "create", "edit", "delete", "purchasePrice", etc.
  label       String                     // "View Invoices"
  description String?                    // "See invoice list and details"
  createdAt   DateTime @default(now())

  rolePermissions RolePermission[]

  @@unique([module, action])
  @@index([module])
}

model RolePermission {
  id           String   @id @default(cuid())
  roleId       String
  permissionId String
  createdAt    DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@index([roleId])
}

model UserRole {
  id         String   @id @default(cuid())
  userId     String
  roleId     String
  businessId String
  assignedBy String                      // userId of who assigned this role
  assignedAt DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role     Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@unique([userId, businessId])          // one role per user per business
  @@index([businessId])
  @@index([userId])
}

// ──────────────────────────────
// STAFF INVITE
// ──────────────────────────────

model StaffInvite {
  id         String           @id @default(cuid())
  businessId String
  name       String
  phone      String
  roleId     String
  code       String                      // 6-digit access code
  status     StaffInviteStatus @default(PENDING)
  invitedBy  String                      // userId
  expiresAt  DateTime
  acceptedAt DateTime?
  acceptedBy String?                     // userId who accepted
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  role     Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@index([businessId])
  @@index([code])
  @@index([phone])
}

enum StaffInviteStatus {
  PENDING
  ACCEPTED
  EXPIRED
  CANCELLED
}

// ──────────────────────────────
// TRANSACTION LOCK & APPROVALS
// ──────────────────────────────

model TransactionLockConfig {
  id                          String   @id @default(cuid())
  businessId                  String   @unique
  lockAfterDays               Int?                        // null = never lock
  requireApprovalForEdit      Boolean  @default(false)
  requireApprovalForDelete    Boolean  @default(false)
  priceChangeThresholdPercent Float?                      // null = no threshold
  discountThresholdPercent    Float?                      // null = no threshold
  operationPinHash            String?                     // bcrypt hash of operation PIN
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
}

model ApprovalRequest {
  id              String         @id @default(cuid())
  businessId      String
  type            ApprovalType
  entityType      String                  // "INVOICE", "PAYMENT", "PRODUCT"
  entityId        String
  requestedBy     String                  // userId
  requestedChanges Json                   // { field, before, after, reason }
  status          ApprovalStatus @default(PENDING)
  reviewedBy      String?                 // userId (owner)
  reviewedAt      DateTime?
  reviewNote      String?
  expiresAt       DateTime                // auto-deny after 72 hours
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, status])
  @@index([requestedBy])
  @@index([entityType, entityId])
}

enum ApprovalType {
  EDIT_LOCKED_TRANSACTION
  DELETE_TRANSACTION
  PRICE_OVERRIDE
  DISCOUNT_OVERRIDE
}

enum ApprovalStatus {
  PENDING
  APPROVED
  DENIED
  EXPIRED
}

// ──────────────────────────────
// AUDIT LOG
// ──────────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  businessId  String
  userId      String
  action      AuditAction
  entityType  String                    // "INVOICE", "PAYMENT", "PRODUCT", "PARTY", "ROLE", "SETTING"
  entityId    String
  entityLabel String?                   // "Invoice #INV-0042" — for display without joins
  before      Json?                     // snapshot before change
  after       Json?                     // snapshot after change
  changes     Json?                     // [{ field, before, after }] — diffed for readability
  reason      String?                   // required for delete/lock override
  ipAddress   String?
  deviceInfo  String?
  createdAt   DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, createdAt])
  @@index([businessId, entityType, entityId])
  @@index([businessId, userId])
  @@index([businessId, action])
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  RESTORE           // from recycle bin
  LOCK_OVERRIDE     // owner unlocked a locked transaction
  PIN_RESET
  ROLE_CHANGE       // staff role changed
  APPROVAL_REQUEST
  APPROVAL_RESPONSE
}

// ──────────────────────────────
// APP SETTINGS (per user)
// ──────────────────────────────

model AppSettings {
  id                String      @id @default(cuid())
  userId            String      @unique
  dateFormat        DateFormat  @default(DD_MM_YYYY)
  pinEnabled        Boolean     @default(false)
  pinHash           String?                         // bcrypt hash
  biometricEnabled  Boolean     @default(false)
  failedPinAttempts Int         @default(0)
  lockedUntil       DateTime?                       // lockout timestamp
  calculatorPosition String     @default("BOTTOM_RIGHT")
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum DateFormat {
  DD_MM_YYYY       // 14/03/2026 — Indian default
  MM_DD_YYYY       // 03/14/2026 — US
  YYYY_MM_DD       // 2026-03-14 — ISO
}
```

### IndexedDB Schema (Dexie — Offline Cache)

```typescript
// db.ts — Dexie schema additions for Settings & Security

interface DexieDB extends Dexie {
  roles: Table<OfflineRole>;
  permissions: Table<OfflinePermission>;
  userRole: Table<OfflineUserRole>;
  appSettings: Table<OfflineAppSettings>;
  auditLogQueue: Table<OfflineAuditEntry>;    // queue for offline audit entries
  approvalRequests: Table<OfflineApproval>;
  transactionLockConfig: Table<OfflineLockConfig>;
}

// Dexie store definitions
db.version(X).stores({
  roles: 'id, businessId, name, isSystem',
  permissions: 'id, [module+action]',
  userRole: 'id, userId, businessId',
  appSettings: 'id, userId',
  auditLogQueue: '++localId, businessId, synced',         // localId for offline, synced flag
  approvalRequests: 'id, businessId, status',
  transactionLockConfig: 'id, businessId',
});

// Permission check — runs locally, never hits network
function hasPermission(userId: string, businessId: string, permission: string): boolean {
  const userRole = db.userRole.where({ userId, businessId }).first();
  if (!userRole) return false;
  const role = db.roles.get(userRole.roleId);
  if (!role) return false;
  return role.permissions.includes(permission);
}

// PIN verification — runs locally
async function verifyPin(pin: string): Promise<boolean> {
  const settings = await db.appSettings.where({ userId: currentUserId }).first();
  if (!settings?.pinHash) return false;
  return bcryptCompare(pin, settings.pinHash);  // bcrypt.js in browser
}
```

---

## 6. UI States

### 6A. Role Builder Screen

```
┌─────────────────────────────────────┐
│ ← Create Role                       │
├─────────────────────────────────────┤
│                                     │
│ Role Name                           │
│ ┌─────────────────────────────────┐ │
│ │ Godown Manager                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Description (optional)              │
│ ┌─────────────────────────────────┐ │
│ │ Manages inventory and stock     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Start from template:                │
│ [Owner] [Manager] [Billing] [Blank] │
│                                     │
│ ─── Permissions ──────────────────  │
│                                     │
│ ▼ Invoicing                         │
│   ┌────────┬─────┬─────┬─────┬────┐│
│   │        │View │Crea │Edit │Del ││
│   │ Toggle │ ☑   │ ☑   │ ☐   │ ☐  ││
│   │ All    │     │     │     │    ││
│   └────────┴─────┴─────┴─────┴────┘│
│                                     │
│ ▼ Inventory                         │
│   ┌────────┬─────┬─────┬─────┬────┐│
│   │        │View │Add  │Edit │Del ││
│   │ Toggle │ ☑   │ ☑   │ ☑   │ ☐  ││
│   │ All    │     │     │     │    ││
│   └────────┴─────┴─────┴─────┴────┘│
│                                     │
│ ▶ Payments (collapsed)              │
│ ▶ Parties (collapsed)               │
│ ▶ Reports (collapsed)               │
│ ▶ Settings (collapsed)              │
│                                     │
│ ▼ Sensitive Fields                  │
│   ☐ View purchase price             │
│   ☐ View profit margin              │
│   ☐ View party phone                │
│   ☐ View party outstanding          │
│                                     │
├─────────────────────────────────────┤
│         [ Save Role ]               │
└─────────────────────────────────────┘
```

**States:**
- **Empty** — Role name focused, all permissions unchecked, "Start from template" highlighted
- **Template selected** — permissions pre-filled from template, user can toggle individual ones
- **Saving** — button shows spinner, fields disabled
- **Saved** — redirect to roles list with success toast
- **Error** — inline error on name field ("Role name already exists"), or network error toast
- **Offline** — yellow banner "You're offline. Role will sync when connected." — save works locally

### 6B. Permission Matrix (Role Detail View)

```
┌─────────────────────────────────────┐
│ ← Manager                    [Edit] │
├─────────────────────────────────────┤
│ 3 staff members using this role     │
│                                     │
│ ┌──────────────┬──┬──┬──┬──┬──┐    │
│ │ Module       │👁 │➕ │✏️ │🗑 │📤 │    │
│ ├──────────────┼──┼──┼──┼──┼──┤    │
│ │ Invoicing    │✓ │✓ │✓ │✗ │✓ │    │
│ │ Inventory    │✓ │✓ │✓ │✗ │— │    │
│ │ Payments     │✓ │✓ │✓ │✗ │— │    │
│ │ Parties      │✓ │✓ │✓ │✗ │— │    │
│ │ Reports      │✓ │✗ │— │— │✓ │    │
│ │ Settings     │✗ │— │✗ │— │— │    │
│ ├──────────────┼──┼──┼──┼──┼──┤    │
│ │ Fields       │                │    │
│ │ Purchase $   │✗                │    │
│ │ Profit %     │✗                │    │
│ │ Party phone  │✓                │    │
│ │ Outstanding  │✓                │    │
│ └──────────────┴──┴──┴──┴──┴──┘    │
│                                     │
│ Legend: ✓ Allowed  ✗ Denied  — N/A  │
│                                     │
│ ─── Staff with this role ─────────  │
│ ┌─────────────────────────────────┐ │
│ │ 👤 Rajesh   ● Active   Today   │ │
│ │ 👤 Suresh   ● Active   2d ago  │ │
│ │ 👤 Meena    ○ Suspended        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 6C. PIN Setup Screen

```
┌─────────────────────────────────────┐
│                                     │
│         🔒 Set App PIN              │
│                                     │
│    Protect your business data       │
│    with a PIN lock                  │
│                                     │
│         ○ ○ ○ ○ ○ ○                │
│     (dots fill as digits entered)   │
│                                     │
│     ┌───┬───┬───┐                  │
│     │ 1 │ 2 │ 3 │                  │
│     ├───┼───┼───┤                  │
│     │ 4 │ 5 │ 6 │                  │
│     ├───┼───┼───┤                  │
│     │ 7 │ 8 │ 9 │                  │
│     ├───┼───┼───┤                  │
│     │   │ 0 │ ⌫ │                  │
│     └───┴───┴───┘                  │
│                                     │
│     [Use fingerprint instead]       │
│                                     │
│     [Skip — set up later]           │
│                                     │
└─────────────────────────────────────┘
```

**States:**
- **Set PIN** — "Enter a 4-6 digit PIN" → dots fill → auto-advance to confirm
- **Confirm PIN** — "Confirm your PIN" → dots fill → match check
- **Mismatch** — dots shake, "PINs don't match. Try again." → clear, restart
- **Weak PIN** — "This PIN is too simple" warning (1234, 0000, repeating digits)
- **Success** — checkmark animation → "PIN set!" → redirect
- **Lockout** — "Too many attempts. Try again in 30:00" → countdown timer
- **Forgot** — "Forgot PIN?" link → OTP verification → reset flow

### 6D. PIN Unlock Screen (App Launch)

```
┌─────────────────────────────────────┐
│                                     │
│          [Business Logo]            │
│         Business Name               │
│                                     │
│         ● ● ● ○ ○ ○                │
│       (3 of 6 digits entered)       │
│                                     │
│     ┌───┬───┬───┐                  │
│     │ 1 │ 2 │ 3 │                  │
│     ├───┼───┼───┤                  │
│     │ 4 │ 5 │ 6 │                  │
│     ├───┼───┼───┤                  │
│     │ 7 │ 8 │ 9 │                  │
│     ├───┼───┼───┤                  │
│     │ 🔐│ 0 │ ⌫ │                  │
│     └───┴───┴───┘                  │
│       ↑ biometric button            │
│                                     │
│     [Forgot PIN?]                   │
│                                     │
│     4 of 5 attempts remaining       │
│                                     │
└─────────────────────────────────────┘
```

### 6E. Calculator Overlay

```
┌─────────────────────────────────────┐
│   (current app screen visible       │
│    behind semi-transparent overlay)  │
│                                     │
├─────── drag handle ─────────────────┤
│ ┌─────────────────────────────────┐ │
│ │                       1,180.00  │ │  ← result
│ │  1000 + 18%                     │ │  ← expression
│ └─────────────────────────────────┘ │
│                                     │
│  GST: [5%] [12%] [18%] [28%]      │
│  Mode: ○ Exclusive  ● Inclusive     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Base:  Rs 1,000.00         │   │
│  │  GST:   Rs   180.00 (18%)  │   │
│  │  Total: Rs 1,180.00         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌───┬───┬───┬───┐                 │
│  │ C │ ⌫ │ % │ ÷ │                 │
│  ├───┼───┼───┼───┤                 │
│  │ 7 │ 8 │ 9 │ × │                 │
│  ├───┼───┼───┼───┤                 │
│  │ 4 │ 5 │ 6 │ − │                 │
│  ├───┼───┼───┼───┤                 │
│  │ 1 │ 2 │ 3 │ + │                 │
│  ├───┼───┼───┼───┤                 │
│  │ 00│ 0 │ . │ = │                 │
│  └───┴───┴───┴───┘                 │
│                                     │
│  [Paste to field]   [Copy]          │
│                                     │
└─────────────────────────────────────┘
```

**States:**
- **Basic mode** — standard calculator, no GST section visible
- **GST mode** — GST rate buttons visible, breakdown shown
- **History** — swipe up on result area to see last 10 calculations
- **Paste active** — when an input field was focused before opening, "Paste to field" is blue/enabled
- **Paste inactive** — no field was focused, "Paste to field" is grayed out, "Copy" copies to clipboard

### 6F. Settings Main Screen

```
┌─────────────────────────────────────┐
│ Settings                            │
├─────────────────────────────────────┤
│                                     │
│ ─── Security ───────────────────    │
│ ┌─────────────────────────────────┐ │
│ │ 🔒 App PIN              [On ●] │ │
│ │ 🔐 Biometric Auth       [Off ○]│ │
│ │ 🔑 Change App PIN         →    │ │
│ │ 🔑 Operation PIN       [Set ●] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─── Staff & Roles ──────────────    │
│ ┌─────────────────────────────────┐ │
│ │ 👥 Manage Staff (3 active)  →  │ │
│ │ 🎭 Manage Roles (5 roles)  →  │ │
│ │ ➕ Invite Staff             →  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─── Transaction Controls ───────    │
│ ┌─────────────────────────────────┐ │
│ │ 🔒 Lock after        [30 days] │ │
│ │ ✅ Approve edits        [On ●] │ │
│ │ ✅ Approve deletes      [On ●] │ │
│ │ 📊 Price threshold       [10%] │ │
│ │ 📋 Audit Log               →   │ │
│ │ 📋 Pending Approvals (2)   →   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─── Display ────────────────────    │
│ ┌─────────────────────────────────┐ │
│ │ 📅 Date Format     [DD/MM/YYYY]│ │
│ │ ⌨️ Keyboard Shortcuts      →   │ │
│ │ 🧮 Calculator Position         │ │
│ │    ○ Bottom Right (default)     │ │
│ │    ○ Bottom Left                │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### 6G. Audit Log Screen

```
┌─────────────────────────────────────┐
│ ← Audit Log            [Filter 🔽] │
├─────────────────────────────────────┤
│ Filter: All Staff | All Actions     │
│ Date: Last 7 days                   │
├─────────────────────────────────────┤
│                                     │
│ Today, 14 Mar 2026                  │
│ ┌─────────────────────────────────┐ │
│ │ 🗑 Rajesh deleted Invoice #42   │ │
│ │   Amount: Rs 5,000              │ │
│ │   Reason: "Duplicate entry"     │ │
│ │   10:30 AM                      │ │
│ ├─────────────────────────────────┤ │
│ │ ✏️ Suresh edited Invoice #38    │ │
│ │   Total: Rs 3,000 → Rs 3,500   │ │
│ │   Qty (Item 1): 5 → 6          │ │
│ │   09:15 AM                      │ │
│ ├─────────────────────────────────┤ │
│ │ ➕ Meena created Invoice #45    │ │
│ │   Customer: Sharma Traders      │ │
│ │   Amount: Rs 12,500             │ │
│ │   08:45 AM                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Yesterday, 13 Mar 2026             │
│ ┌─────────────────────────────────┐ │
│ │ 🔓 Owner unlocked Invoice #30   │ │
│ │   Reason: "Customer dispute"    │ │
│ │   04:20 PM                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│          [Load more...]             │
└─────────────────────────────────────┘
```

### 6H. Keyboard Shortcuts Sheet

```
┌─────────────────────────────────────┐
│ ← Keyboard Shortcuts                │
├─────────────────────────────────────┤
│                                     │
│ Show hints in tooltips     [On ●]   │
│                                     │
│ ─── Billing ────────────────────    │
│ │ New Invoice         Ctrl + N  │   │
│ │ Save                Ctrl + S  │   │
│ │ Print               Ctrl + P  │   │
│ │ Add Line Item       Enter     │   │
│ │ Next Field          Tab       │   │
│ │ Cancel              Escape    │   │
│                                     │
│ ─── Navigation ─────────────────    │
│ │ Search              Ctrl + K  │   │
│ │ Calculator          Ctrl + .  │   │
│ │ Dashboard           Alt + 1   │   │
│ │ Invoices            Alt + 2   │   │
│ │ Parties             Alt + 3   │   │
│ │ Inventory           Alt + 4   │   │
│ │ Reports             Alt + 5   │   │
│                                     │
│ Customization coming soon           │
│                                     │
└─────────────────────────────────────┘
```

---

## 7. Mobile

All screens designed for 375px (iPhone SE) as minimum. Tested at 375px, 390px (iPhone 14), 412px (Pixel 7).

### 7A. Role Builder on Mobile (375px)

- Permission matrix switches from grid to **accordion list** on mobile
- Each module is a collapsible section
- Inside each section: vertical list of toggles (not a grid)
- "Toggle All" switch at the top of each module section
- Sticky header with role name input
- Sticky bottom bar with "Save Role" button

```
┌──────────────────────┐
│ ← Create Role        │  ← sticky header
├──────────────────────┤
│ Role Name            │
│ [Godown Manager    ] │
│                      │
│ Template: [Manager▼] │
│                      │
│ ▼ Invoicing     All ○│
│   View           [●] │
│   Create         [●] │
│   Edit           [○] │
│   Delete         [○] │
│   Share          [●] │
│                      │
│ ▶ Inventory          │
│ ▶ Payments           │
│ ▶ Parties            │
│ ▶ Reports            │
│ ▶ Settings           │
│ ▶ Sensitive Fields   │
│                      │
├──────────────────────┤
│   [ Save Role ]      │  ← sticky footer
└──────────────────────┘
```

### 7B. Permission Toggles

- Toggle switch (not checkbox) on mobile — easier to tap
- Each toggle is 48px minimum tap target (WCAG 2.5.8)
- Toggle row: label left, switch right, full-width tap area
- Module headers: tap anywhere to expand/collapse
- "Toggle All" — top-right of each module — toggles all children

### 7C. PIN Pad on Mobile

- PIN pad buttons: 64px x 64px minimum (comfortable thumb tap)
- Centered on screen with generous spacing
- Haptic feedback on each tap (Capacitor Haptics)
- Biometric button: bottom-left of PIN pad (fingerprint icon)
- Error: dots shake animation (CSS keyframes, 300ms)
- Lockout: full-screen overlay with countdown timer

### 7D. Calculator Overlay on Mobile

- Opens as bottom sheet (60% height default)
- Drag handle for resize (40%-80%)
- Swipe down to dismiss
- Calculator buttons: 56px x 48px — fits 4 columns on 375px
- GST quick-calc row: scrollable horizontal if needed
- "Paste" button stretches full-width when field is active
- FAB button: 56px, positioned 16px from right edge, 72px above bottom nav

### 7E. Settings Screen on Mobile

- Full-width cards with chevron for navigation items
- Toggle switches for on/off items
- Segmented control for date format selection (3 options, fits on 375px)
- Grouped sections with subtle gray headers
- All tap targets 48px+ height

---

## 8. Edge Cases

### Roles & Permissions

| Edge Case | Handling |
|-----------|----------|
| Owner deletes their own role | **Blocked.** Owner role is system role, cannot be deleted or modified. |
| Last admin removed | **Blocked.** "Business must have at least 1 owner. Transfer ownership first." |
| Owner downgrades self to Viewer | **Blocked.** Owner role cannot be changed. Must transfer ownership. |
| Transfer ownership | Owner goes to staff profile → "Transfer Ownership" → confirms with operation PIN → new owner gets Owner role, old owner becomes Manager. Irreversible without new owner's consent. |
| Custom role name conflicts with system role | **Blocked.** Validation: "This name is reserved. Choose a different name." |
| Delete role with active staff | **Required:** must reassign staff to another role before delete. UI forces selection. |
| Staff has multiple roles across businesses | Allowed. Permissions are scoped per business. Switching business loads that business's role. |
| Permission check fails offline | **Always passes locally.** Roles cached in IndexedDB on login + every sync. If cache is empty (first login offline), block all actions except viewing cached data. |
| Staff invited but business is at tier limit | "Your plan allows 3 staff. Upgrade to Business plan for unlimited staff." Invite blocked. |
| Role updated while staff is using app | Next sync (or next app open) pulls new permissions. Active session continues with old permissions until refresh. Push notification: "Your permissions were updated by [owner]." |

### PIN & Biometric

| Edge Case | Handling |
|-----------|----------|
| Forgot app PIN | "Forgot PIN?" → OTP sent to registered phone → verify → set new PIN. Audit logged. |
| Forgot operation PIN | Owner only: OTP to phone → verify → reset operation PIN. **Cannot be reset by staff.** |
| PIN + biometric both fail | After 5 failed PINs → 30 min lockout. Biometric has no attempt limit (device handles it). During lockout, "Forgot PIN?" still accessible. |
| Device doesn't support biometric | Biometric toggle hidden in settings. PIN is the only option. |
| Biometric enrolled changes (new fingerprint added) | OS handles this — Capacitor BiometricAuth re-validates. No app-side concern. |
| App killed during PIN entry | On relaunch, PIN screen shows again (no bypass). |
| PIN set on one device, opening on another | PIN is per-user (synced to server). Set on device A, device B fetches pinHash on login. |
| Shared phone — multiple HisaabApp users | Each user logs in with their own phone number. PIN is per-user, not per-device. |
| Lockout expires while app is in background | On foregrounding, check lockout time. If expired, allow PIN entry. |

### Transaction Locks

| Edge Case | Handling |
|-----------|----------|
| Lock period changes after transactions exist | Retroactive. If changed from 30 to 7 days, all transactions older than 7 days immediately locked. |
| Staff edits invoice, save triggers lock check | Check at save time, not load time. If locked between load and save, reject with message. |
| Approval request expires (72h) | Auto-denied. Staff notified: "Your request to edit Invoice #X has expired." |
| Owner offline when approval requested | Request queued locally on staff's device. When both sync, notification delivered. |
| Multiple approval requests for same transaction | Allowed. Each is independent. Latest approved/denied applies. |
| Transaction locked but payment needs to be linked | Linking a payment to a locked invoice is allowed (additive). Editing the invoice itself is locked. |

### Calculator

| Edge Case | Handling |
|-----------|----------|
| Division by zero | Display "Cannot divide by zero" instead of result. |
| Very large numbers | Max 15 digits. Beyond that: "Number too large." |
| Paste when no field is active | "Paste" disabled. "Copy to clipboard" available instead. |
| Calculator open + notification comes | Calculator stays. Notification renders above calculator. |
| Calculator result has too many decimals | Auto-round to 2 decimal places. Show full precision on long-press of result. |

### Offline Scenarios

| Edge Case | Handling |
|-----------|----------|
| Role created offline by owner on 2 devices | Conflict resolution: last-write-wins with server timestamp. Both roles may exist if names differ. If same name, server version wins. |
| Staff removed while offline | Staff continues with cached role. On next sync, forced logout from that business. |
| Audit log generated offline | Queued in IndexedDB `auditLogQueue`. Synced to server in order when online. |
| Settings changed offline | Cached locally, synced when online. If server has newer version, merge: server wins for security settings (PIN, lock), user wins for display settings (date format). |

---

## 9. Constraints

### Limits

| Constraint | Limit | Reason |
|-----------|-------|--------|
| Max custom roles per business | 20 | Prevent confusion. 4 system + 20 custom = 24 total. |
| Max staff per tier (Free) | 1 (owner only) | Upsell to Pro |
| Max staff per tier (Pro) | 3 | Upsell to Business |
| Max staff per tier (Business) | Unlimited | Enterprise value |
| PIN length | 4-6 digits | Balance security vs convenience |
| PIN lockout duration | 30 minutes | Prevent brute force |
| PIN lockout after | 5 failed attempts | Standard security |
| Approval request expiry | 72 hours | Prevent stale requests |
| Audit log retention (server) | 365 days | Storage cost. Older entries archived to cold storage. |
| Audit log retention (device) | 30 days | IndexedDB space |
| Transaction lock override duration | 1 hour | Temporary unlock, auto-relocks |
| Invite code validity | 48 hours | Security |
| Calculator history | 10 entries | UI simplicity |
| Max permissions per role | 32 (all of them) | No limit really, but 32 is the total |
| Weak PINs blacklist | 1234, 0000, 1111, 2222, ..., 9999, 1234, 4321, 1122, 2580 | Common PINs |

### Performance

| Requirement | Target |
|-------------|--------|
| Permission check latency | < 5ms (local IndexedDB lookup) |
| PIN verification | < 100ms (local bcrypt compare) |
| Role builder load | < 200ms |
| Audit log page load | < 500ms (paginated, 50 per page) |
| Calculator launch | < 100ms (pre-loaded component) |
| Biometric prompt | < 300ms to appear |

### Security

| Requirement | Implementation |
|-------------|---------------|
| PIN storage | bcrypt hash (cost factor 10). Never stored in plaintext. |
| Operation PIN | Separate bcrypt hash. Stored on server and local. |
| Permission enforcement | Backend validates on every mutation. Frontend hides UI but backend is the authority. |
| Audit log integrity | Append-only. No delete API. Admin panel can view but not modify. |
| Role changes | Audit logged. Push notification to affected staff. |
| Staff removal | Immediate token revocation on server. Next sync forces re-auth. |
| Invite codes | 6 random digits, not sequential. Expired codes cannot be reused. |

---

## 10. Out of Scope

| Feature | Why Out of Scope | When |
|---------|-----------------|------|
| Advanced audit trail with diff view and rollback | Requires UI for comparing JSON snapshots, undo engine. Logging is in scope, viewing diffs is basic, rollback is not. | Phase 6 (#139) |
| Multi-firm management | Tenant isolation, switching businesses, shared parties. Separate complex feature. | Phase 6 (#138) |
| PIN for individual transactions (require PIN for high-value invoices) | Depends on transaction controls being stable first. | Phase 6 (#140) |
| Customizable keyboard shortcuts | Default shortcuts ship in Phase 1. Custom keybinding UI is future. | Phase 5+ |
| Two-factor authentication (2FA) | Already part of Auth (#1) from DudhHisaab. Not part of this PRD. | Phase 1A (Auth) |
| IP-based access restrictions | Enterprise feature. Not needed for MSMEs. | Phase 7+ |
| Session management (force logout other devices) | Nice to have. Not MVP. | Phase 3+ |
| Role-based dashboard (different dashboards per role) | All users see same dashboard, just with data filtered by permissions. Custom dashboards later. | Phase 5+ |
| Scheduled auto-lock (lock app after X minutes inactive) | PIN on launch is sufficient for MVP. Timeout lock is nice-to-have. | Phase 3+ |
| Scientific calculator mode | Basic + percentage + GST is enough. Scientific is unused by target users. | Never |

---

## 11. Build Plan

### Phase Breakdown

| Step | Feature | Estimated Days | Dependencies | Priority |
|------|---------|---------------|-------------|----------|
| 1 | Permission model + seed data (Prisma schema, migration, seed 32 permissions) | 1 | Database setup | P0 |
| 2 | Role CRUD API (create, read, update, delete roles) | 1.5 | Step 1 |P0 |
| 3 | System roles seed (Owner, Manager, Billing Staff, Viewer with default permissions) | 0.5 | Step 2 | P0 |
| 4 | UserRole assignment API + permission check middleware | 1 | Step 2 | P0 |
| 5 | Staff invite flow (API: invite, accept, list, suspend, remove) | 1.5 | Step 4 | P0 |
| 6 | Frontend: Role builder screen (permission matrix UI, template clone) | 2 | Step 2 | P0 |
| 7 | Frontend: Staff management screen (list, invite, edit role, suspend, remove) | 1.5 | Step 5 | P0 |
| 8 | Offline: Cache roles + permissions in IndexedDB, local permission checks | 1 | Step 6 | P0 |
| 9 | Transaction lock config API + enforcement middleware | 1 | Step 4 | P0 |
| 10 | Approval request flow (API: create, review, expire) + push notifications | 1.5 | Step 9 | P0 |
| 11 | Frontend: Transaction controls settings screen | 1 | Step 9, 10 | P0 |
| 12 | Audit log model + logging middleware (auto-log every mutation) | 1.5 | Step 1 | P0 |
| 13 | Frontend: Audit log viewer (filtered, paginated, grouped by date) | 1 | Step 12 | P0 |
| 14 | PIN system: set, verify, reset, lockout (API + local bcrypt) | 1 | Auth system | P0 |
| 15 | Operation PIN: set, verify, reset (owner only) | 0.5 | Step 14 | P0 |
| 16 | Frontend: PIN setup screen + PIN unlock screen + lockout UI | 1.5 | Step 14 | P0 |
| 17 | Biometric auth: Capacitor BiometricAuth plugin integration | 1 | Step 16 | P1 |
| 18 | Frontend: Biometric toggle in settings, fallback to PIN | 0.5 | Step 17 | P1 |
| 19 | Date format setting (API + frontend: format selector, apply globally) | 0.5 | — | P1 |
| 20 | Keyboard shortcuts system (event listener, default config, tooltip hints) | 1 | — | P2 |
| 21 | Built-in calculator (component, GST calc, paste-to-field, history) | 1.5 | — | P1 |
| 22 | Integration testing (role + permissions + lock + audit across all modules) | 2 | All above | P0 |
| 23 | Offline sync testing (roles sync, audit queue, settings merge) | 1 | Step 8 | P0 |

**Total estimated: ~25 days** (1 developer)

### Build Order

```
Week 1: Foundation (Steps 1-5)
  ├─→ Prisma schema + migration
  ├─→ Permission seed data
  ├─→ Role CRUD API
  ├─→ System roles seed
  ├─→ UserRole + permission middleware
  └─→ Staff invite API

Week 2: Frontend Roles + Security Backend (Steps 6-10, 12, 14-15)
  ├─→ Role builder UI
  ├─→ Staff management UI
  ├─→ IndexedDB offline cache
  ├─→ Transaction lock API + middleware
  ├─→ Approval flow API
  ├─→ Audit log middleware
  ├─→ PIN system (app + operation)
  └─→ PIN frontend

Week 3: Frontend Security + Utilities (Steps 11, 13, 16-21)
  ├─→ Transaction controls UI
  ├─→ Audit log viewer
  ├─→ PIN unlock screen
  ├─→ Biometric integration
  ├─→ Date format
  ├─→ Keyboard shortcuts
  └─→ Calculator

Week 4: Testing + Polish (Steps 22-23)
  ├─→ Integration tests
  ├─→ Offline sync tests
  ├─→ Edge case testing
  └─→ Performance validation
```

---

## 12. Acceptance Criteria

### Feature 56: Custom User Roles/Permissions

- [ ] Owner can create a custom role with any combination of 32 permissions
- [ ] Owner can clone an existing role as a starting template
- [ ] 4 system roles exist by default: Owner (all), Manager (all except delete + settings), Billing Staff (create invoices + payments only), Viewer (read-only)
- [ ] System roles cannot be deleted (edit is allowed for Manager/Billing Staff/Viewer, not Owner)
- [ ] Owner can assign a role to a staff member
- [ ] Permission check enforced on both frontend (UI hidden) and backend (API rejects)
- [ ] `fields.purchasePrice` permission correctly hides/shows purchase price column in invoices, products, and reports
- [ ] `fields.profitMargin` permission correctly hides/shows profit margin display during billing
- [ ] Staff with no `invoicing.delete` permission cannot see delete button on any invoice
- [ ] Roles work offline — cached in IndexedDB, permission checks run locally in < 5ms
- [ ] Deleting a role requires reassigning all staff to another role first

### Feature 57: Transaction Edit/Delete Controls

- [ ] Owner can configure lock period: 7 / 15 / 30 days / never
- [ ] Transactions older than lock period show locked icon, edit/delete buttons disabled
- [ ] Owner can override lock with operation PIN — temporary unlock for 1 hour
- [ ] Lock override requires a reason (free text), logged in audit trail
- [ ] Approval requests sent as push notifications to owner
- [ ] Owner can approve/deny from notification or pending approvals screen
- [ ] Approval auto-expires after 72 hours with notification to requester
- [ ] Price change threshold: edit rejected if price change exceeds configured % (staff gets "Requires approval" message)
- [ ] All edits and deletes logged in audit trail with before/after values

### Feature 58: Passcode / PIN Protection

- [ ] User can set 4-6 digit PIN during onboarding or in settings
- [ ] PIN required on every app launch (cold start and resume from background)
- [ ] Weak PINs (1234, 0000, repeating digits) show warning but are not blocked
- [ ] 5 failed attempts trigger 30-minute lockout with visible countdown
- [ ] "Forgot PIN" flow: OTP to registered phone → verify → set new PIN
- [ ] PIN stored as bcrypt hash locally and on server
- [ ] Operation PIN is separate from app PIN, set by owner only
- [ ] Operation PIN required for: approving deletes, editing locked transactions, overriding locks

### Feature 59: Biometric Auth

- [ ] Fingerprint/Face ID unlock via Capacitor BiometricAuth plugin
- [ ] Enable/disable toggle in settings (hidden if device doesn't support biometric)
- [ ] Biometric prompt shown before PIN pad on app launch (if both enabled)
- [ ] "Use PIN instead" fallback button always visible during biometric prompt
- [ ] Biometric failure does not count toward PIN lockout attempts

### Feature 60: Date Format Customization

- [ ] 3 options: DD/MM/YYYY (default), MM/DD/YYYY, YYYY-MM-DD
- [ ] Setting applies to: dashboard, invoice list, invoice detail, invoice PDF, reports, payment history, audit log, party statements
- [ ] Date format persisted in AppSettings (local + server)
- [ ] Changing format immediately updates all visible dates without page reload

### Feature 61: Keyboard Shortcuts

- [ ] All default shortcuts work: Ctrl+N (new invoice), Ctrl+S (save), Ctrl+P (print), Enter (add line item), Tab (next field), Escape (cancel), Ctrl+K (search), Ctrl+. (calculator)
- [ ] Alt+1-5 navigate to Dashboard/Invoices/Parties/Inventory/Reports
- [ ] Shortcuts shown in tooltips when "Show hints" is enabled
- [ ] Shortcuts do not fire when user is typing in a text input (except Tab and Enter which have input-specific behavior)
- [ ] Shortcuts only active on desktop/tablet (window width > 768px)

### Feature 62: Built-in Calculator

- [ ] Calculator accessible via FAB button on all screens
- [ ] Opens as bottom sheet overlay — does not dismiss current screen
- [ ] Basic operations: + - x / = C backspace
- [ ] Percentage: "250 + 18%" = 295
- [ ] GST quick-calc: tap rate button → shows base, GST amount, total
- [ ] GST toggle: inclusive vs exclusive calculation
- [ ] "Paste to field" inserts result into previously focused input field
- [ ] If no field was focused, "Copy to clipboard" is available
- [ ] Calculator state persists while navigating (until explicitly closed)
- [ ] Calculator opens in < 100ms
- [ ] Also accessible via Ctrl+. shortcut on desktop

### Cross-Cutting

- [ ] All security features work offline (PIN, biometric, permission checks, transaction locks)
- [ ] Audit log entries generated offline are queued and synced in order when online
- [ ] Settings sync: security settings (PIN, locks) — server wins on conflict. Display settings (date format, calculator position) — latest timestamp wins.
- [ ] Staff tier limits enforced: Free=1, Pro=3, Business=unlimited
- [ ] All screens responsive from 375px to 1440px
- [ ] All tap targets 48px+ on mobile
- [ ] PIN pad has haptic feedback on native app (Capacitor Haptics)

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Permission matrix validated (32 permissions cover all modules)
- [ ] Prisma schema reviewed
- [ ] API contracts reviewed
- [ ] Offline behavior validated
- [ ] Edge cases reviewed
- [ ] Build plan timeline agreed
