---
symptom: Saving a party with an opening balance always fails — the form stays put and shows "Failed to save party".
root_cause_file: server/src/schemas/party.schemas.ts:38
root_cause_reason: asOfDate is validated as an RFC-3339 *datetime* while the field is a calendar day everywhere else in the app, so the only value the client can produce (YYYY-MM-DD) is rejected.
---

## 5-whys

1. **Why does the party not save?** `POST /api/parties` returns 400
   `VALIDATION_ERROR — "openingBalance.asOfDate: asOfDate must be a valid ISO date"`.
2. **Why is asOfDate invalid?** The client sends `"2026-07-26"`. The schema is
   `z.string().datetime()`, which demands a time component and offset
   (`2026-07-26T00:00:00Z`).
3. **Why does the client send a date-only string?** `PartyFormCredit` stamps
   `asOfDate` with `toLocalISODate(new Date())` — the same `YYYY-MM-DD` helper
   every date field in the app uses, because `<input type="date">` speaks that
   format and nothing about an opening balance has a time of day.
4. **Why did the two sides disagree?** Nobody owns the wire format for a
   calendar date. The server has at least four ad-hoc spellings —
   `z.string().datetime()`, `z.string().date()`, and two hand-rolled
   `/^\d{4}-\d{2}-\d{2}$/` regexes — chosen per schema. `openingBalance` drew
   the datetime one; the domain value is a day.
5. **Why did no test catch it?** Every server test for `createParty` omits
   `openingBalance` (it is optional), and no E2E case had exercised the form's
   Credit accordion until TC-PTY-01. The only path that ever wrote an opening
   balance was the Excel importer, which constructs `new Date()` in service
   code and never touches the schema.

## Hypothesis

`asOfDate` is a calendar date, not an instant: it names the day a balance was
struck, has no time-of-day input anywhere in the product, and is read back as a
day (`report-party.ts` formats it for a statement header). Validating it as a
datetime is the defect — it makes the field unusable from the only UI that sets
it, and it would have kept failing however the client was patched, because any
`toISOString()` the client sends re-interprets a local day as a UTC instant and
can land on the previous date for IST users. The fix belongs in the schema: accept
a calendar date, and keep accepting a full datetime so the importer and any
already-queued offline mutation still validate.

## Failing test

- `server/src/__tests__/parties.test.ts` — "accepts a calendar-date asOfDate on
  an opening balance" (unit, red before the change)
- `e2e/gold/parties.spec.ts` — TC-PTY-01 (E2E, red before the change: the form
  never navigates away from /parties/new)

## Did I fix the symptom or the cause?

The cause. The symptom is "the save button does nothing"; patching it would have
meant reformatting the date in `PartyFormCredit`, which leaves the contract
wrong — the next client to send a day (the offline replay queue, the mobile
build, an integration) would 400 again, and the `toISOString()` reformat would
have introduced a timezone-shift bug of its own. The contract now matches the
domain.
