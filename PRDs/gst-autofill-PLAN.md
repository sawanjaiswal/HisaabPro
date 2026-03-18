# #83 GST Autofill — PRD

## What
When a user enters a valid 15-character GSTIN in the party creation/edit form, automatically verify it against the backend GSTIN API and auto-populate: legal name, trade name, registration status, and state code. Gives instant feedback on whether the GSTIN is active/valid.

## Why
- Reduces manual data entry errors (wrong name, wrong state)
- Builds trust — user sees "Verified" badge next to GSTIN
- Competitive parity with Vyapar/MyBillBook who both have this
- Required foundation for correct GST invoicing (legal name on invoices)

## User Flow
1. User opens Create/Edit Party → Business section
2. Types GSTIN (auto-uppercased, max 15 chars)
3. At 15 chars, client validates format locally (gstin.utils.ts)
4. If valid format → auto-triggers server verification (debounced 500ms)
5. Shows inline loading spinner next to GSTIN field
6. On success: shows green "Verified" badge, auto-fills legal name → companyName, state → address state, PAN extracted
7. On failure (invalid/cancelled/suspended): shows warning with status
8. User can override auto-filled values (they're suggestions, not locked)

## Data Model Changes
**PartyFormData** — add optional fields:
- `gstinVerified?: boolean` — was this GSTIN verified via API
- `gstinLegalName?: string` — legal name from GST portal
- `gstinStatus?: string` — Active/Cancelled/Suspended

**PartyDetail** — add same fields for display on detail page

**GstinVerifyResult** — already exists in tax.types.ts with: `valid`, `stateCode`, `legalName`, `status`, `type`

## API Contract
Already exists: `POST /gstin/verify` with `{ gstin }` body → returns `GstinVerifyResult`

No backend changes needed — the service function `verifyGstin()` in `tax.service.ts` is ready.

## UI States
- **Idle**: Empty GSTIN field, hint text "PAN will be auto-filled from GSTIN"
- **Typing**: < 15 chars, no verification
- **Validating**: 15 chars entered, spinner next to field
- **Verified**: Green check + "Verified — [Legal Name]" + auto-filled fields
- **Failed**: Red warning + error message (invalid format, not found, cancelled)
- **Overridden**: User modified auto-filled value, subtle "Modified from verified data" note

## Files to Modify
1. `party.types.ts` — add gstinVerified, gstinLegalName, gstinStatus to PartyFormData & PartyDetail
2. `usePartyForm.ts` — add GSTIN verification logic with debounce, auto-populate companyName
3. `PartyFormBusiness.tsx` — add verification status UI (spinner, badge, error), show legal name
4. `party.constants.ts` — add GST status labels, state code → state name map
5. `EditPartyPage.tsx` — pass new fields from detail to form initialData

## Acceptance Criteria
- [ ] Entering valid 15-char GSTIN triggers verification after 500ms debounce
- [ ] Spinner shows during verification
- [ ] Verified: green badge, legal name auto-fills companyName, PAN extracted, state code mapped
- [ ] Invalid/cancelled GSTIN shows warning (not blocking — user can still save)
- [ ] Edit mode: if GSTIN already verified, shows badge without re-verifying
- [ ] Auto-filled values are editable (not locked)
- [ ] Works on 375px and 320px screens
- [ ] AbortController cancels in-flight verification on GSTIN change or unmount

## Out of Scope
- Backend GSTIN API changes (already exists)
- E-invoice integration
- Bulk GSTIN verification
- GSTIN search/lookup (only verify known GSTIN)
