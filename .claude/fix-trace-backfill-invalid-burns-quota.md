---
symptom: A rejected GST backfill request consumes the business's one run per hour, so a typo locks the wizard for an hour
root_cause_file: server/src/routes/gst-backfill.route.ts:92
root_cause_reason: the rate limiter sits ahead of body validation and the tax-category ownership check, so a request the server was always going to refuse still counts against the quota
---

## 5-whys

1. Why can a shopkeeper not run the backfill? — The one run per hour was already spent.
2. Why was it spent when no backfill ran? — The refused request counted: `backfillRateLimit` runs
   before `validate(executeBackfillSchema)` and before the tax-category ownership check.
3. Why does the order matter? — A rate limiter counts every request that reaches it. Anything it can
   only ever answer with a 400 should be refused upstream of it.
4. Why was the Idempotency-Key check ordered correctly then? — It was: the route's own comment says
   "this must run before the rate limiter so invalid requests don't consume quota". The rule was
   written down and then applied to one of the three refusals.
5. Why does only one of them follow it? — The tax-category check lives inside the handler rather than
   as a middleware, and a check inside the handler cannot be ordered ahead of the limiter.

## Hypothesis

Every refusal this route can make — missing key, malformed body, a tax category that is not this
business's — is knowable without doing any work, so all three belong ahead of the limiter, exactly as
the Idempotency-Key check already is. Lifting the tax-category check out of the handler into its own
middleware makes that ordering expressible.

## Failing test

e2e/gold/gst-backfill.spec.ts — TC-GSTBF-03 (a tax category from outside the business is refused)
followed by TC-GSTBF-04 (the real run still succeeds afterwards). Before the fix, TC-GSTBF-04 got a
429 because TC-GSTBF-03 had eaten the hour.
