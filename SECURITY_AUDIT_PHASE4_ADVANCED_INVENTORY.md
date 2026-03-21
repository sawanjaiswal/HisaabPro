# SECURITY AUDIT — Phase 4 Advanced Inventory Frontend (Red Team)

**Scope:** 57 files — batches · godowns · serial-numbers · stock-verification features + App.tsx Phase 4 routes + routes.config.ts
**Auditor:** Red Team (adversarial review — injection, auth bypass, business logic abuse, XSS, IDOR)
**Date:** 2026-03-20
**Verdict:** REJECTED — 3 HIGH + 4 MEDIUM findings. Fix HIGHs and MEDIUMs before ship.

---

## CHECKLIST RESULTS

| Check | Result |
|-------|--------|
| All Phase 4 routes behind ProtectedRoute | PASS — App.tsx lines 234-246 all wrapped |
| No dangerouslySetInnerHTML | PASS — zero occurrences |
| No eval / dynamic code execution | PASS |
| No hardcoded secrets | PASS |
| No localStorage token storage | PASS — httpOnly cookies via credentials:include |
| encodeURIComponent on URL-embedded user input | PASS — useSerialLookup.ts line 30 |
| No open redirect via user-controlled URL | PASS |
| Input validation: field length limits | PASS — maxLength on inputs + hook validation |
| Input validation: negative quantities blocked | PASS (form UI) |
| Input validation: float quantities blocked | FAIL — see HIGH-02 |
| Confirmation on destructive bulk write | FAIL — see HIGH-03 |
| AppShell on all feature pages | FAIL — see HIGH-01 |
| Integer-only guard on stock count | FAIL — see LOW-01 |
| Deleted-resource filter before transfer | FAIL — see MEDIUM-02 |
| Empty productId guard in serial hooks | FAIL — see MEDIUM-03 |
| Registered route for every navigated path | FAIL — see MEDIUM-01 |

---

## HIGH FINDINGS

---

### HIGH-01 — Stock-Verification Pages Missing AppShell (Navigation Shell Isolation)

**Severity:** HIGH
**Files:**
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/stock-verification/VerificationsPage.tsx` — line 30
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/stock-verification/VerificationDetailPage.tsx` — line 42

**Evidence:**

Both stock-verification pages return a raw `<div className="sv-page">`. Neither imports AppShell or Header. Every other Phase 4 feature (batches, godowns, serial-numbers) wraps its pages in `<AppShell>`:

```tsx
// VerificationsPage.tsx line 30 — no AppShell, no Header, no BottomNav
return (
  <div className="sv-page">
    <header className="sv-page__header">
      <h1 className="sv-page__title">Stock Verification</h1>
```

```tsx
// VerificationDetailPage.tsx — back button is hand-coded to a specific route
<button type="button" onClick={() => navigate(ROUTES.STOCK_VERIFICATION)} aria-label="Back to verifications">
```

**Impact:**

1. `BottomNav` is rendered exclusively by `AppShell`. Without it, users on stock-verification pages lose the app's primary navigation. If they reach this page from a deep link (notification, WhatsApp share), they are stranded with only the custom back button.
2. The hand-coded back button navigates to `ROUTES.STOCK_VERIFICATION` — but `VerificationsPage` itself also lacks AppShell. Navigating back lands on another shell-less page. The user is trapped in an isolated UI context.
3. Navigation isolation is an attack surface for social engineering: an attacker can share a deep link to a legitimate verification URL. The stripped-down UI looks unfamiliar and could be used to trick the user into trusting a phishing page that mimics the same minimal design.

Routes ARE behind `ProtectedRoute` in App.tsx (lines 241-242), so auth itself is not bypassed. The vulnerability is navigation context isolation.

---

### HIGH-02 — Float Quantities Accepted for Stock Transfer and Batch Opening Stock

**Severity:** HIGH
**Files:**
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/godowns/useTransferForm.ts` — line 55
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/godowns/components/TransferForm.tsx` — lines 92-107
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/batches/useBatchForm.ts` — lines 83-84, 115
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/batches/components/BatchForm.tsx` — lines 111-125

**Evidence:**

Transfer form quantity input: no `step` attribute, no `Number.isInteger()` check:

```tsx
// TransferForm.tsx lines 93-107 — no step="1", no integer validation
<input
  type="number"
  inputMode="numeric"
  value={form.quantity || ''}
  onChange={(e) => onUpdate('quantity', Number(e.target.value))}
  placeholder="0"
  min={1}
  // NO step="1" — browser allows 0.5, 1.5, 0.001
/>
```

```ts
// useTransferForm.ts line 55 — only checks > 0, not integer
if (!form.quantity || form.quantity <= 0) {
  next.quantity = 'Quantity must be greater than 0'
}
// Number("0.5") passes this check. It is sent to the backend as-is.
```

Batch opening stock has the identical gap:

```ts
// useBatchForm.ts line 83-84
if (form.currentStock && (isNaN(Number(form.currentStock)) || Number(form.currentStock) < 0)) {
  next.currentStock = 'Enter a valid quantity'
}
// Number("1.5") = 1.5 — passes. Sent to backend as Number("1.5") = 1.5 on line 115.
```

**Impact:** A user (or attacker with DevTools access) can submit `quantity: 0.001` for a stock transfer. This gradually drains stock from a godown in fractional units without triggering whole-unit depletion alerts. Repeated over time it corrupts inventory totals. The CLAUDE.md explicitly mandates integer stock values ("Amounts in paise (integer math, no floating point)"). The frontend is the first defense line and it is missing here.

**Attack scenario:** Malicious staff member submits 500 transfers of 0.001 units. System shows 0.5 units transferred but no individual alert is triggered. Godown stock is corrupted.

---

### HIGH-03 — "Adjust Stock" Is a One-Click Irreversible Bulk Write With No Confirmation

**Severity:** HIGH
**File:** `/Users/sawanjaiswal/Projects/HisaabPro/src/features/stock-verification/VerificationDetailPage.tsx` — lines 94-104

**Evidence:**

```tsx
{isCompleted && hasDiscrepancies && (
  <button
    type="button"
    className="sv-detail__action-btn sv-detail__action-btn--warning"
    onClick={adjustStock}   // fires immediately — no confirmation step
    disabled={isProcessing}
  >
    <RefreshCw size={18} aria-hidden="true" />
    Adjust Stock
  </button>
)}
```

`adjustStock` in `useVerificationDetail.ts` (lines 56-70) immediately fires `POST /stock-verification/${id}/adjust`. This writes actual stock quantities to the database for ALL discrepant items in a single operation.

By direct comparison:
- Batch delete uses a `DeleteBatchDialog` confirmation modal (`DeleteBatchDialog.tsx`)
- Godown delete uses `window.confirm()` (`GodownDetailPage.tsx` line 33)
- "Adjust Stock" — which modifies more data than either delete — has zero confirmation gate

The "Complete Verification" button (line 70-75) and "Adjust Stock" button are rendered in the same section. A user who just completed a count will see both buttons in quick succession. A misclick on "Adjust Stock" triggers an irreversible bulk inventory write.

**Attack scenario:** Staff member accidentally taps "Adjust Stock" immediately after "Complete Verification" on a mobile device. All discrepancy-count items are permanently adjusted with no undo. Physical inventory is now mismatched with system records.

---

## MEDIUM FINDINGS

---

### MEDIUM-01 — GODOWN_EDIT Route Defined in routes.config.ts But Not Registered in App.tsx

**Severity:** MEDIUM
**Files:**
- `/Users/sawanjaiswal/Projects/HisaabPro/src/config/routes.config.ts` — line 93
- `/Users/sawanjaiswal/Projects/HisaabPro/src/App.tsx` — missing registration
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/godowns/GodownDetailPage.tsx` — line 48

**Evidence:**

```ts
// routes.config.ts line 93 — route is defined
GODOWN_EDIT: '/godowns/:id/edit',
```

```tsx
// GodownDetailPage.tsx line 48 — navigates to this unregistered route
onClick={() => navigate(`/godowns/${id}/edit`)}
```

```tsx
// App.tsx Phase 4 block — GODOWN_EDIT is absent
<Route path={ROUTES.GODOWN_NEW} element={...} />
<Route path={ROUTES.GODOWN_TRANSFER} element={...} />
<Route path={ROUTES.GODOWNS} element={...} />
<Route path={ROUTES.GODOWN_DETAIL} element={...} />
// No GODOWN_EDIT route
```

**Impact:** Clicking "Edit" on any godown navigates to `/godowns/:id/edit` which matches the `<Route path="*">` wildcard — it renders `NotFoundPage`. Edit functionality is silently broken.

Security concern: the `GODOWN_EDIT` route constant is defined without a `ProtectedRoute` wrapper being applied (since it is never registered). If a future developer registers the route by copy-pasting from a lazy import block without the `ProtectedRoute` wrapper, the edit endpoint becomes unauthenticated. The missing registration is both a bug and a latent security footgun.

---

### MEDIUM-02 — TransferForm Dropdown Fetches All Godowns Without Filtering Deleted Ones

**Severity:** MEDIUM
**Files:**
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/godowns/TransferPage.tsx` — line 17
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/godowns/components/TransferForm.tsx` — lines 55-59, 78-82

**Evidence:**

```tsx
// TransferPage.tsx line 17 — fetches godowns, no isDeleted filter parameter
const { data, status, error, refetch } = useApi<GodownListResponse>('/godowns?limit=200')
```

```tsx
// TransferForm.tsx — renders all godowns with no isDeleted === false check
{godowns.map((g) => (
  <option key={g.id} value={g.id}>{g.name}</option>
))}
```

The `Godown` type includes `isDeleted: boolean` (godown.types.ts line 9). The client does not filter `isDeleted === false` before populating the dropdown. If the backend returns soft-deleted godowns in this listing (a backend misconfiguration or future regression), a user can select a deleted godown as the transfer destination. Stock sent to a deleted godown becomes unreachable.

**Attack scenario:** Backend bug returns deleted godown in list. Staff initiates transfer to "Main Warehouse (Deleted)". Stock disappears from source, never arrives at an accessible location.

---

### MEDIUM-03 — Serial Number Hooks Fire API Calls With Empty productId String

**Severity:** MEDIUM
**Files:**
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/serial-numbers/useSerialNumbers.ts` — lines 24-43
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/serial-numbers/useSerialForm.ts` — line 50
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/serial-numbers/useBulkSerialForm.ts` — line 53
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/serial-numbers/SerialsPage.tsx` — line 16
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/serial-numbers/CreateSerialPage.tsx` — line 9
- `/Users/sawanjaiswal/Projects/HisaabPro/src/features/serial-numbers/BulkCreateSerialPage.tsx` — line 9

**Evidence:**

All three serial pages default `productId` to empty string, not `undefined`:

```tsx
// SerialsPage.tsx line 16, CreateSerialPage.tsx line 9, BulkCreateSerialPage.tsx line 9
const { productId = '' } = useParams<{ productId: string }>()
```

The hooks do not guard against empty string before making the API call:

```ts
// useSerialNumbers.ts lines 24-35 — no empty-string guard
useEffect(() => {
  const controller = new AbortController()
  setStatus('loading')
  // Fires: GET /serial-numbers/product/?limit=20
  // ↑ empty segment in the URL path
  api<SerialListResponse>(`/serial-numbers/product/${productId}?${params}`, { ... })
```

Compare to `useBatches` which correctly guards:
```ts
// useBatches.ts lines 27-29 — correct null guard
const path = productId
  ? `/products/${productId}/batches?limit=${BATCH_PAGE_SIZE}`
  : null  // useApi skips the call when path is null
```

**Impact:** When `productId` is empty (direct navigation, stale URL, missing param), the API is called with an empty path segment. Backend behavior is undefined — depending on routing implementation it may 404, 500, or (worst case) return all serial numbers for the business (cross-product IDOR). The bulk create hook has the same gap: empty productId sends `POST /serial-numbers/product/bulk` which could create serials unattached to any product.

---

### MEDIUM-04 — productId and batchId in TransferForm Are Freeform Text Inputs With No Validation

**Severity:** MEDIUM
**File:** `/Users/sawanjaiswal/Projects/HisaabPro/src/features/godowns/components/TransferForm.tsx` — lines 22-39, 110-119

**Evidence:**

```tsx
// TransferForm.tsx lines 26-35 — raw text input for productId
<input
  id="transfer-product"
  type="text"
  value={form.productId}
  onChange={(e) => onUpdate('productId', e.target.value)}
  placeholder="Enter product ID"
  // No maxLength. No UUID format validation. No product picker.
/>
```

```tsx
// TransferForm.tsx lines 110-119 — raw text input for batchId
<input
  id="transfer-batch"
  type="text"
  value={form.batchId ?? ''}
  onChange={(e) => onUpdate('batchId', e.target.value)}
  placeholder="Batch ID (optional)"
  // No maxLength. No UUID validation.
/>
```

The `useTransferForm.validate()` only checks `!form.productId` (presence), not format:

```ts
// useTransferForm.ts line 49
if (!form.productId) next.productId = 'Select a product'
// Any non-empty string passes. No UUID check.
```

**Impact:**

1. No `maxLength` means an arbitrarily long string is sent to the backend. A 10KB productId string in a JSON body is a potential payload amplification attack.
2. A user can type a productId belonging to another business. The backend must enforce business-scoped ownership on the transfer endpoint — but the frontend is providing zero pre-validation or affordance to prevent cross-business ID submission.
3. No product search UI means users must know exact UUIDs. This is also an IDOR attack surface: a curious user can enumerate product IDs by trying sequential UUIDs.

---

## LOW FINDINGS

---

### LOW-01 — parseInt NaN Passes the `< 0` Guard in CountItemRow

**Severity:** LOW
**File:** `/Users/sawanjaiswal/Projects/HisaabPro/src/features/stock-verification/components/CountItemRow.tsx` — lines 18-22

**Evidence:**

```ts
const parsed = qty === '' ? null : parseInt(qty, 10)

const handleSave = () => {
  if (parsed === null || parsed < 0) return  // NaN < 0 is false — NaN passes this guard
  onSave(item.id, { actualQuantity: parsed, ... })
}
```

`parseInt('abc', 10)` returns `NaN`. `NaN < 0` is `false` in JavaScript. The guard `parsed < 0` does not catch NaN. `onSave` is called with `actualQuantity: NaN`. The backend Zod schema should reject this, but the frontend should not send it.

Additionally, `parseInt('1.5', 10)` returns `1`, silently truncating. A user typing a decimal sees a computed diff based on the decimal (`1.5 - expected`) but the saved value is `1` — creating a confusing display/save mismatch.

**Fix:**
```ts
if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return
```

---

### LOW-02 — GodownDetailPage Uses window.confirm for Delete Confirmation

**Severity:** LOW
**File:** `/Users/sawanjaiswal/Projects/HisaabPro/src/features/godowns/GodownDetailPage.tsx` — line 33

**Evidence:**

```ts
if (!window.confirm(`Delete "${godown.name}"? This cannot be undone.`)) return
deleteGodown(id, godown.name)
navigate(ROUTES.GODOWNS)  // navigates BEFORE async delete completes
```

Two compounding issues:
1. `window.confirm` is unreliable in Capacitor WebViews (Android/iOS). It can be suppressed, show inconsistently, or be auto-dismissed in certain Android system WebViews — allowing the delete to proceed without user confirmation.
2. `navigate(ROUTES.GODOWNS)` fires immediately after `deleteGodown()` without awaiting the async operation. If the delete fails, the user is already on the godowns list. The error toast fires from the background. The godown still appears in the list until the next refresh.

`BatchDetailPage.handleDelete` is correctly implemented: it `await`s the API call and only navigates on success. The godown delete is inconsistent.

---

### LOW-03 — navigate(-1) in BatchDetailPage Depends on Browser History Stack

**Severity:** LOW
**File:** `/Users/sawanjaiswal/Projects/HisaabPro/src/features/batches/BatchDetailPage.tsx` — line 49

**Evidence:**

```ts
navigate(-1)  // after successful batch delete
```

If a user reaches `/batches/:id` via a direct link (WhatsApp share, notification, bookmark), the history stack is empty. `navigate(-1)` sends them outside the app to the browser's previous URL. The expected behavior is to navigate to the batch list for the product. Godown delete correctly uses `navigate(ROUTES.GODOWNS)`.

---

## INFO FINDINGS

---

### INFO-01 — IDOR Surface: All Phase 4 Resource IDs Are User-Controlled URL Params (Backend Must Enforce)

**Severity:** INFO (frontend cannot fix — requires backend enforcement)

All Phase 4 detail pages extract resource IDs from `useParams()` and pass them directly to API calls:
- `BatchDetailPage`: `/batches/${id}`
- `GodownDetailPage`: `/godowns/${id}` and `/godowns/${id}/stock`
- `VerificationDetailPage`: `/stock-verification/${id}`
- `SerialsPage`: `/serial-numbers/product/${productId}`

Any authenticated user can visit `/batches/ANOTHER_BUSINESS_BATCH_ID` and the frontend will make the API call. This is architecturally correct — IDOR prevention belongs on the backend. Flagged here so the backend audit team verifies every Phase 4 endpoint scopes its queries with `where: { businessId: req.user.businessId }`.

---

### INFO-02 — DELETE Operations Are Queued in Offline Sync (Replay Risk)

**Severity:** INFO
**File:** `/Users/sawanjaiswal/Projects/HisaabPro/src/lib/offline.constants.ts` — line 16

```ts
export const SYNC_MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
```

DELETE requests (batch delete, godown delete) are queued when offline and replayed when reconnected. If the resource was already deleted by another user in the interim, the replayed DELETE fires against a non-existent resource. The backend must return 404 gracefully (not 500) for already-deleted resources to prevent the offline sync queue from getting stuck.

---

## SUMMARY TABLE

| ID | Severity | Finding | File |
|----|----------|---------|------|
| HIGH-01 | HIGH | Stock-verification pages missing AppShell — navigation isolation | VerificationsPage.tsx, VerificationDetailPage.tsx |
| HIGH-02 | HIGH | Float quantities accepted for stock transfer and batch opening stock | useTransferForm.ts, TransferForm.tsx, useBatchForm.ts |
| HIGH-03 | HIGH | "Adjust Stock" fires immediately with no confirmation (irreversible bulk write) | VerificationDetailPage.tsx |
| MEDIUM-01 | MEDIUM | GODOWN_EDIT route defined but not registered in App.tsx — edit is broken + latent unprotected route risk | App.tsx, GodownDetailPage.tsx |
| MEDIUM-02 | MEDIUM | TransferForm fetches all godowns with no isDeleted filter — deleted godown can be transfer target | TransferPage.tsx, TransferForm.tsx |
| MEDIUM-03 | MEDIUM | Serial hooks fire with empty productId — no null guard — potential cross-product IDOR | useSerialNumbers.ts, useSerialForm.ts, useBulkSerialForm.ts |
| MEDIUM-04 | MEDIUM | ProductId and batchId in TransferForm are freeform text inputs — no maxLength, no UUID validation | TransferForm.tsx, useTransferForm.ts |
| LOW-01 | LOW | parseInt NaN not blocked by `< 0` guard — NaN can be sent to backend | CountItemRow.tsx |
| LOW-02 | LOW | window.confirm for godown delete (Capacitor-unsafe) + navigate before await | GodownDetailPage.tsx |
| LOW-03 | LOW | navigate(-1) after batch delete breaks on direct-link entry | BatchDetailPage.tsx |
| INFO-01 | INFO | IDOR surface on all resource IDs — backend must enforce businessId ownership scoping | All useParams detail pages |
| INFO-02 | INFO | DELETE ops queued offline — backend must handle 404 gracefully on replay | offline.constants.ts |

---

## VERDICT: REJECTED

**Must fix before ship (HIGHs):**
- HIGH-01: Wrap VerificationsPage and VerificationDetailPage in AppShell
- HIGH-02: Add `Number.isInteger()` check in useTransferForm.validate() and useBatchForm.validate(); add `step="1"` to quantity inputs
- HIGH-03: Add a confirmation dialog before adjustStock fires (matching DeleteBatchDialog pattern)

**Should fix before ship (MEDIUMs):**
- MEDIUM-01: Register GODOWN_EDIT route in App.tsx with ProtectedRoute wrapper
- MEDIUM-02: Filter `isDeleted === false` from godowns before populating TransferForm selects
- MEDIUM-03: Guard serial hooks against empty productId (match the null-guard pattern in useBatches)
- MEDIUM-04: Add maxLength={36} + UUID regex validation to productId/batchId inputs; replace with product search ideally

**Fix in next sprint (LOWs):**
- LOW-01: Add `Number.isNaN(parsed)` check in CountItemRow.handleSave
- LOW-02: Replace window.confirm with dialog; await deleteGodown before navigate
- LOW-03: Replace navigate(-1) with explicit navigate to ROUTES.BATCHES after batch delete

**Backend team action required:**
- INFO-01: Verify all Phase 4 GET/PATCH/DELETE endpoints scope to req.user.businessId
- INFO-01: Verify /serial-numbers/product/ (empty segment) returns 404, not all serials
- INFO-02: Verify DELETE on already-deleted resource returns 404 (not 500) for offline sync resilience
