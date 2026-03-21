# Test Specification: Universal Form Patterns

## 1. Feature Summary

Universal form pattern tests verify consistent form behavior across ALL forms in the application. Every form — from godown creation to stock verification entry to POS checkout — must follow the same UX patterns: validation on blur, tab order, submit states, error preservation, and accessibility. This TSD defines the reusable pattern that applies to every form in Phase 4 features.

**Applies to forms on:** `/godowns` (create/edit), `/godowns/transfer`, `/products/:id/batches` (create/edit), `/products/:id/serials` (add single/bulk), `/stock-verification` (create), `/stock-verification/:id` (count entry), `/pos` (cart qty, discount, checkout), `/serials/lookup` (search)
**Priority:** P0 (blocks release)
**Depends on:** All Phase 4 feature forms implemented

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in | Valid session |
| 2 | Target form page accessible | Navigate to any form in Phase 4 |
| 3 | At least 1 required field exists on form | Most forms have at least name/number required |
| 4 | Browser autofill data available | Saved address/phone in browser for autofill tests |
| 5 | Keyboard available | For tab order and keyboard navigation tests |
| 6 | Screen reader available (optional) | VoiceOver (Mac) or NVDA (Windows) for a11y tests |

---

## 3. Test Scenarios

### 3a. Happy Path — Universal Pattern (apply to EACH form)

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | **Initial state**: Open form | All inputs empty (create) or pre-filled (edit), submit button enabled but validates on click, no error messages visible | DOM: no `.error` elements, inputs in default state |
| 2 | **Focus first field**: Page loads | First input field has focus automatically | DOM: `document.activeElement` = first input |
| 3 | **Type in required field**: Enter valid value | Input shows value, no validation error | DOM: input value matches, no error |
| 4 | **Tab to next field**: Press Tab | Focus moves to next logical field in order | DOM: `document.activeElement` = next input |
| 5 | **Blur required field (valid)**: Tab away from filled required field | No error shown (field is valid) | DOM: no error for this field |
| 6 | **Blur required field (empty)**: Focus then blur a required field without entering value | Error shown: "[Field] is required" | DOM: error element visible, `aria-describedby` linked |
| 7 | **Blur with invalid format**: Enter "abc" in phone field, blur | Error shown: "Enter a valid phone number" | DOM: inline error under input |
| 8 | **Fix error**: Correct the invalid input and blur | Error disappears | DOM: error element removed |
| 9 | **Fill all fields correctly**: Complete all form fields | All fields valid, no errors | DOM: 0 error elements |
| 10 | **Submit form**: Click submit button | Button shows loading state (disabled + spinner), form submits | DOM: button disabled, spinner visible |
| 11 | **Success**: API returns success | Success toast shown, navigate away or form resets | Visual: toast, URL change or clean form |
| 12 | **Submit button re-enabled**: After success or error | Button returns to normal state | DOM: button enabled, no spinner |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | Submit with all fields empty | Click submit on blank form | All required fields show errors, focus moves to first error field |
| 2 | Submit with partial fields | Fill some, leave others blank | Only empty required fields show errors |
| 3 | Server validation error (unique constraint) | Submit duplicate godown name | Server error displayed inline on the name field: "A godown with this name already exists" |
| 4 | Server error (500) | API returns 500 | Toast: "Something went wrong. Please try again." + Retry. Form data preserved |
| 5 | Network timeout | Request times out (10s) | Toast: "Request timed out. Check your connection." Form data preserved |
| 6 | Network offline | Submit while offline | Queue for sync with "Will save when online" message, OR error with data preserved |
| 7 | Double submit (rapid clicks) | Click submit twice quickly | Button disabled after first click, only 1 API request sent |
| 8 | Double submit (ref guard) | Programmatic double-trigger | `useRef` guard prevents second execution |
| 9 | Invalid characters in text field | Enter SQL injection: `'; DROP TABLE--` | Input sanitized, no server error, stored safely |
| 10 | Exceeds max length | 1000 chars in name field (max 100) | "Maximum 100 characters" error on blur, counter shown |
| 11 | XSS in input | `<script>alert(1)</script>` in name | Rendered as text, not executed. Sanitized before storage |
| 12 | Zero in numeric field (where disallowed) | Enter 0 in qty (min 1) | "Must be at least 1" error |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | **Browser autofill**: Browser fills phone/address | Autofill triggers | Values accepted, validation runs on filled values, no visual glitch |
| 2 | **Paste in field**: Paste a value (Cmd+V / Ctrl+V) | Paste triggers | Value accepted, validation runs, trimmed of leading/trailing whitespace |
| 3 | **Paste multiline in single-line field**: Paste text with newlines | Paste in name field | Newlines stripped, single line preserved |
| 4 | **Cut and paste**: Cut field value, paste in another field | Cut/paste operations | Both fields update correctly, validation runs |
| 5 | **Undo (Cmd+Z)**: Type, then undo | Undo in input | Value reverts, validation re-runs |
| 6 | **Password manager fill**: 1Password/Bitwarden fills field | External fill trigger | Value accepted, change event fires, validation runs |
| 7 | **IME input (Hindi)**: Type in Hindi using IME | Hindi text in name field | Unicode accepted, displayed correctly, stored correctly |
| 8 | **Emoji in text field**: Enter emoji in note/name | Emoji characters | Accepted in note fields, rejected in structured fields (phone, batch#) with error |
| 9 | **Very long input**: 10,000 chars pasted | Paste in textarea | Truncated to max length, character counter shows limit |
| 10 | **Form resize (keyboard open on mobile)**: Mobile keyboard opens | Soft keyboard pushes viewport | Submit button remains accessible (not behind keyboard), inputs scroll into view |
| 11 | **Landscape mode**: Rotate phone to landscape | Form reflows | All fields accessible, no horizontal scroll, submit button visible |
| 12 | **Switch app and return (mobile)**: Fill form → switch to another app → return | App returns | Form data preserved, no loss |

### 3d. State Transitions

| From | Action | To | Verify |
|------|--------|----|--------|
| Pristine (no interaction) | User focuses any field | Touched | Field tracks touched state |
| Touched | User blurs without value (required) | Error shown | Error visible, `aria-invalid="true"` |
| Error shown | User enters valid value | Error cleared | Error removed, `aria-invalid="false"` |
| Valid form | Click submit | Submitting (loading) | Button disabled, spinner shown, inputs read-only |
| Submitting | API success | Success | Toast, redirect/reset |
| Submitting | API error | Error (form preserved) | Error message, button re-enabled, data intact |
| Submitting | Network timeout | Error (form preserved) | Timeout message, button re-enabled, data intact |
| Error (server) | User fixes and resubmits | Submitting | Previous error cleared, new attempt |
| Any state | Browser refresh | Depends on form | Create forms: data lost (acceptable). POS cart: preserved. Verification counts: preserved |
| Any state | Navigate away (unsaved) | Confirmation dialog | "Unsaved changes" warning |

---

## 4. API Contracts

Not applicable (pattern applies to all form APIs). Each form's specific API is in its feature TSD.

**Universal error response format (all forms must handle):**
```typescript
// Validation error (422)
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: [
      { field: "name", message: "Name is required" },
      { field: "phone", message: "Enter a valid phone number" }
    ]
  }
}

// Conflict error (409)
{
  success: false,
  error: {
    code: "DUPLICATE",
    message: "A godown with this name already exists",
    field: "name"
  }
}

// Server error (500)
{
  success: false,
  error: {
    code: "INTERNAL_ERROR",
    message: "Something went wrong"
  }
}
```

**Frontend must:**
1. Map `details[].field` to the correct input and show inline error
2. Map `field` from conflict error to the specific input
3. Show generic toast for 500 errors, preserve form data

---

## 5. Visual Checkpoints

| Form State | Viewport | What to Check |
|-----------|----------|---------------|
| Pristine | 375x812 | Clean form, labels above inputs, no errors, submit button full-width at bottom |
| Pristine | 320x568 | All fields fit, no horizontal scroll, labels readable |
| Field with error | 375x812 | Red border on input, error text below in red (0.75rem), error icon |
| Multiple errors | 375x812 | Each error below its field, scroll to first error if not visible |
| Submitting (loading) | 375x812 | Button shows spinner + "Saving..." text, disabled appearance, inputs dimmed |
| Success | 375x812 | Success toast (green, auto-dismiss 3s), form clears or navigates |
| Server error | 375x812 | Error toast (red, manual dismiss), form data preserved, button re-enabled |
| Autofill | 375x812 | Autofilled fields have browser styling (yellow background acceptable), values visible |
| Mobile keyboard open | 375x812 | Active input scrolled into view, submit button accessible (above keyboard or via scroll) |
| Edit form (pre-filled) | 375x812 | All fields populated with existing values, submit text = "Update" not "Create" |
| Character counter | 375x812 | "45/100" below input, turns red at 90%+ |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | All inputs have visible labels | `<label>` element with `htmlFor` matching input `id`, positioned above input |
| 2 | Required fields marked | `aria-required="true"` + visual indicator (asterisk with `aria-hidden="true"` + screen reader text) |
| 3 | Errors linked to inputs | `aria-describedby="fieldname-error"` on input, error has matching `id` |
| 4 | Invalid state communicated | `aria-invalid="true"` when field has error |
| 5 | Error summary on submit | Focus moves to first error field, `aria-live="assertive"` announces "[N] errors found" |
| 6 | Submit button labeled | Clear text: "Save Godown", "Transfer Stock", "Complete Sale" (not just "Submit") |
| 7 | Loading state announced | `aria-busy="true"` on form during submission, `aria-live` announces "Saving..." |
| 8 | Success announced | `aria-live="polite"` announces "Godown saved successfully" |
| 9 | Tab order logical | Matches visual order: top-to-bottom, left-to-right within rows |
| 10 | Form landmark | `<form>` element with `aria-label="Create godown"` |
| 11 | Fieldsets for related fields | `<fieldset>` with `<legend>` for groups (e.g., "Contact Details") |
| 12 | Enter submits form | Enter key submits when focus is on any input (except textarea) |
| 13 | Escape cancels modal forms | Escape closes modal/sheet forms, returns to previous state |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Validation feedback (blur) | < 50ms | No visible lag between blur and error appearance |
| Submit button disable | < 16ms (1 frame) | Button disables before API call starts |
| Form render (initial) | < 200ms | Time from navigation to interactive form |
| Form render (edit, pre-fill) | < 500ms | Includes API fetch for existing data |
| Error scroll-to | < 300ms | Time from submit-with-errors to first error scrolled into view |
| Autofill handling | < 100ms | Change events fire and validation runs |
| Character counter update | Every keystroke | No lag, no re-render of entire form |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | All form submissions use auth token | Token in header, not in form body |
| 2 | CSRF protection | Token or SameSite cookie prevents cross-origin form submission |
| 3 | Input sanitization | XSS payloads in any field rendered as text, never executed |
| 4 | SQL injection safe | Prisma parameterizes all queries, raw input never in SQL |
| 5 | File inputs (if any) validate type + size | MIME type checked, max size enforced (5MB default) |
| 6 | No sensitive data in URL | Form data in POST body, not GET query params |
| 7 | Rate limiting on form submission | Prevent brute-force form submission |
| 8 | Server re-validates everything | Client validation is UX only, server validates independently |
| 9 | No autocomplete on sensitive fields | `autocomplete="off"` on OTP, password fields |
| 10 | Form data not in browser history | POST requests, no form data in URL |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
**Apply these to EVERY form in Phase 4:**
- [ ] Required field validation on blur shows inline error
- [ ] Submit with empty required fields → all errors shown, focus on first error
- [ ] Submit button disabled during submission (no double submit)
- [ ] Failed submission preserves all form data
- [ ] Server validation errors displayed inline on correct field
- [ ] Success shows toast and navigates/resets appropriately
- [ ] Tab order matches visual order
- [ ] `aria-invalid`, `aria-describedby`, `aria-required` set correctly
- [ ] Enter key submits form
- [ ] No horizontal scroll on 320px with keyboard open

### Should Pass (P1 — degrades experience)
- [ ] Browser autofill values accepted and validated
- [ ] Paste works correctly (trimmed, validated)
- [ ] Character counter on length-limited fields
- [ ] Unsaved changes warning on navigation
- [ ] Focus moves to first error on failed submit
- [ ] Loading state on submit button (spinner + text)

### Nice to Pass (P2 — polish)
- [ ] Undo (Cmd+Z) works in inputs
- [ ] Hindi/Unicode input accepted in text fields
- [ ] Landscape mode layout correct
- [ ] Fieldsets with legends for grouped fields
- [ ] Smooth scroll to error field

---

## Appendix: Form Inventory (Phase 4)

| Form | Page | Required Fields | Submit Action |
|------|------|----------------|---------------|
| Create Godown | `/godowns` (modal) | name | POST /api/godowns |
| Edit Godown | `/godowns/:id` (modal) | name | PUT /api/godowns/:id |
| Stock Transfer | `/godowns/transfer` | source, destination, 1+ items with qty | POST /api/godowns/transfer |
| Add Batch | `/products/:id/batches` (modal) | batchNumber, costPrice, sellingPrice, openingStock, godownId | POST /api/batches |
| Edit Batch | `/batches/:id` (modal) | batchNumber | PUT /api/batches/:id |
| Add Serial (single) | `/products/:id/serials` (modal) | serialNumber, godownId | POST /api/serial-numbers |
| Add Serial (bulk) | `/products/:id/serials` (modal) | serialNumbers (textarea), godownId | POST /api/serial-numbers/bulk |
| Serial Lookup | `/serials/lookup` | query | GET /api/serial-numbers/lookup |
| Create Verification | `/stock-verification` (modal) | godownId | POST /api/stock-verification |
| Count Entry | `/stock-verification/:id` | physicalQty per product | PUT /api/stock-verification/:id |
| POS Cart (qty input) | `/pos` | quantity > 0 | Client-side state |
| POS Discount | `/pos` | percentage (0-100) or flat amount | Client-side state |
| POS Checkout | `/pos` (sheet) | payment method, amount | POST /api/pos/quick-sale |
