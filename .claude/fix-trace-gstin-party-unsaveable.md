---
symptom: A party with a GSTIN cannot be created from the form — Save does nothing and the request 400s.
root_cause_file: src/features/parties/usePartyForm.ts:163
root_cause_reason: handleSubmit spread the whole form object into createParty, and the form carries display-only GSTIN verification state (gstinVerified/gstinLegalName/gstinStatus) that the `.strict()` createPartySchema rejects as unrecognised keys.
---

## Symptom

`/parties/new` → fill a name, enter a valid GSTIN, wait for "Verified
(Maharashtra)", press Save Party. The page stays. Reproduced against the real
server:

```
POST /api/parties
{"success":false,"error":{"code":"VALIDATION_ERROR",
 "message":": Unrecognized key(s) in object: 'gstinVerified', 'gstinLegalName', 'gstinStatus'"}}
```

## 5-whys

1. **Why does Save do nothing?** — `createParty` throws; `handleSubmit`'s catch
   shows a toast and stays on the page.
2. **Why does it throw?** — the server answers 400 VALIDATION_ERROR with
   "Unrecognized key(s): gstinVerified, gstinLegalName, gstinStatus".
3. **Why are those keys in the request?** — `handleSubmit` built its payload as
   `{ ...form }`, and `usePartyForm`'s verification effect
   (`usePartyForm.ts:76`) writes those three fields into `form` the moment the
   GSTIN verifies.
4. **Why does the server reject them?** — `createPartySchema` is `.strict()`
   (`server/src/schemas/party.schemas.ts:53`). Correctly so: `gstinLegalName`
   and `gstinStatus` are not Party columns at all, and `gstinVerified` is a
   server-owned fact — a client that could assert it could mark any typo
   "verified" and put it on a B2B invoice.
5. **Why did nobody catch it?** — the same class was already hit on the *edit*
   path and fixed there by whitelisting the fields inline
   (`.claude/fix-trace-party-update.md`). The fix was applied to one of the two
   branches of the same function; create kept spreading the raw form. There was
   no shared mapper, so "fix the payload" had two places to be done and only
   one was.

Root cause: no single form→payload mapping. Two `.strict()` schemas were being
fed from a form object that is a superset of both, with the whitelist duplicated
on one branch and missing on the other.

## Hypothesis

Extracting `toCreatePartyPayload` / `toUpdatePartyPayload` into
`src/features/parties/party.payload.ts` — one file that owns the field set each
schema accepts — makes the create path drop the verification state and keeps the
two branches from drifting again. It is also where the rupees→paise conversion
and the blank-custom-field strip belong, since both are payload concerns rather
than form-state concerns.

## Failing test

- `src/features/parties/__tests__/party.payload.test.ts` — asserts the absence
  of `gstinVerified` / `gstinLegalName` / `gstinStatus` in both payloads (a
  `.strict()` schema makes absence the assertion that matters).
- `e2e/gold/parties-list.spec.ts` — TC-PTY-10, which found this.

## Did I fix the symptom or the cause?

The cause. The symptom fixes would have been dropping `.strict()` on the server
(which is what protects `gstinVerified` from a lying client) or deleting the
three keys inline at the create call site (leaving the next added form-only
field to break the same way). The mapper makes the schema's field set explicit
in exactly one place per direction.

## Known follow-up (not this fix)

Nothing on the server ever sets `Party.gstinVerified` — the column is written by
no code path, so `PartyOverviewTab`'s "Verified" badge can never render for a
saved party. Logged separately; persisting verification is a server-side feature,
not a payload bug.
