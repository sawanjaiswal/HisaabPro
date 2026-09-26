# AGENTS.md — Level 6 Engineering & Architecture Mandate

> **Global Directive for All AI Coding Agents:**
> You must operate at **Level 6: Axiomatic Elimination & Root-Level Architecture (SSOT)** from the get-go.
> Never produce Level 1–4 surface band-aids (ad-hoc `navigate(-1)`, string heuristics, hardcoded return paths, scattered state duplicates, or unsequenced multi-page jumps). Every solution must eliminate the entire class of bugs structurally and by construction.

---

## 1. Level 6 Navigation & Flow Engine (Zero Navigation Bugs)

### 1.1. Axiom of Sub-Task Containment (No Form Escapes)
* **Rule:** Secondary entity creation (e.g., *Add Customer* while in *New Invoice*, or *Add Item* while in *Purchase Entry*) **MUST NEVER navigate to a new full-page route**.
* **Mechanism:** Sub-creations must run inside a **TaskFrame (Bottom Sheet on mobile, Modal on desktop)** as an asynchronous sub-flow (`await openSubFlow('party.quickCreate')`).
* **Guarantee:** The parent form (e.g. Invoice draft) is never unmounted, state is never lost, and browser history is untouched.

### 1.2. Axiom of Ephemeral Node Purging (No Zombie Form Stack)
* **Rule:** Creation (`/new`) and Edit (`/:id/edit`) routes are **ephemeral task nodes**.
* **Mechanism:** When a form completes or saves:
  1. It **MUST NEVER** use standard `push` navigation (`navigate('/invoices/123')`).
  2. It **MUST ALWAYS** use `{ replace: true }` to overwrite the ephemeral history entry with the terminal view (`/invoices/123` or caller `returnTo`).
* **Guarantee:** Pressing Back from a newly created item returns to where the user originally started (e.g. Customer Detail or Dashboard), **never back into an empty/re-submitted form**.

### 1.3. Axiom of Unified Back Event Bus
* **Rule:** Top-left UI Back button, Android Hardware Back button (`@capacitor/app`), iOS Edge-Swipe, and Keyboard `Esc` must dispatch to a **single unified navigation bus**.
* **Resolution Order:**
  1. If an overlay / TaskFrame / Bottom Sheet is open $\rightarrow$ Dismiss overlay.
  2. If the current form is dirty / unsaved $\rightarrow$ Trigger deterministic Discard Confirmation modal.
  3. If caller passed `state.returnTo` $\rightarrow$ Navigate to `returnTo` with `{ replace: true }`.
  4. If history stack has internal entries $\rightarrow$ `navigate(-1)`.
  5. Fallback $\rightarrow$ Compute parent route from Topological Route Graph (e.g. `/parties/:id` $\rightarrow$ `/parties`).

---

## 2. Level 6 Core System Axioms

### 2.1. Financial & Business Math SSOT
* **Rule:** Zero floating-point arithmetic for currency.
* **Storage & Processing:** All amounts stored and computed as **integers in paise** (1 INR = 100 paise).
* **Display Only:** Formatting (₹1,00,000.00) occurs strictly at the leaf UI presentation layer via `formatPaise()`.

### 2.2. Offline-First & Sync Reconciler
* **Rule:** The app must be 100% functional without internet connectivity.
* **Storage:** Dexie / IndexedDB is the local Source of Truth.
* **API Invocations:** All network requests route through `api()` with `entityType` and `entityLabel`.
* **Optimistic UI:** Mutation handlers must handle offline optimistic responses safely without dereferencing remote ID fields before synchronization.

### 2.3. Mobile-First UI & 4-State Completeness
* **Rule:** Every view must handle all 4 UI lifecycle states:
  1. **Loading:** Skeleton screens (never blank screens or layout jumps).
  2. **Empty:** High-craft actionable empty state with primary CTA.
  3. **Error:** Recovery CTA (Retry / Offline queue fallback) with descriptive error.
  4. **Content:** Responsive presentation (375px primary, 320px hard minimum floor).
* **Touch Targets:** Minimum $\ge 40$px interactive bounding box.
* **Design Tokens:** Deep Emerald Green (`#026F39`), hero surface (`#003121`), never use raw hex values in components.

---

## 3. Agent Execution Checklist (Before Declaring Any Task Done)

When proposing or implementing features/fixes:
- [ ] **Navigation Check:** Did you avoid routing away from active forms? Are all form completion redirects using `{ replace: true }`?
- [ ] **Back-Button Parity:** Does UI back, Android hardware back, and browser back produce the exact same deterministic destination?
- [ ] **Zero-Patch Guarantee:** Is this fix eliminating the root architectural cause, or is it a surface conditional band-aid?
- [ ] **Type & Linter Cleanliness:** Zero `@ts-ignore`, zero `as any`, zero eslint suppressions.
