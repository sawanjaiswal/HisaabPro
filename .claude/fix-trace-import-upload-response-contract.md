---
symptom: Uploading a file in the import wizard navigates to /imports/undefined — the shop can never reach the preview, so the whole wizard is unusable from the UI
root_cause_file: src/features/import/types/import.types.ts:170
root_cause_reason: CreateImportRes declares a flat {jobId, status, commitToken, counts, fileSha256, …} shape that POST /api/imports has never returned; the route answers {job, existing, previousJobId}, and api<T>() asserts the type instead of checking it, so res.jobId is undefined with no error anywhere
---

## 5-whys

1. Why does the wizard navigate to `/imports/undefined`? — `ImportUpload.tsx:70` passes
   `res.jobId`, which is `undefined`.
2. Why is it undefined? — the server responds `{ job: { id, status, … }, existing: false }`
   (create.route.ts:163/199). There is no top-level `jobId`.
3. Why does the client read `jobId` then? — `CreateImportRes` in the client's own
   `import.types.ts` declares that shape. It is a hand-written copy of a contract that was either
   never the server's or drifted from it.
4. Why did TypeScript not catch the mismatch? — `api<T>()` is a generic assertion: it parses JSON
   and *claims* it is `T`. Nothing at the boundary compares the declared type to the bytes, so a
   client-side DTO can say anything and still compile.
5. Why did no test catch it? — every import test is server-side. The client's transport layer has
   no test that pins its DTO against a real server response, so the two halves were free to drift.

The same drift produced a second, quieter defect: `uploadImport` sends the idempotency key as
`Idempotency-Key`, while `idempotency.ts:18` reads `x-idempotency-key`. The header is simply
ignored, so a double-submitted upload is processed twice instead of replayed — the exact case the
key exists for.

Two more drifts surfaced once the wizard could actually reach the network:

- **Format casing.** The client's `ImportFormat` was lowercase (`'vyapar_csv'`); the server's
  `uploadBodySchema` is `.strict()` over the uppercase `IMPORT_FORMATS` enum. Every upload was a
  400 regardless of file.
- **`X-Client-Version` never sent, anywhere.** `uploadImport` appended `clientVersion` as a FORM
  FIELD — which `.strict()` rejects (`Unrecognized key(s) in object: 'clientVersion'`, captured
  live at 400) — while `require-min-client-version.ts:43` reads the HEADER, and in production a
  missing header is a hard 426 on **all five** import routes (create, list, get, commit,
  error-csv). So in dev the import wizard 400'd on upload; in production the entire import API
  would have been unreachable from the app.

  `error-csv` is the one route that cannot be fixed client-side: it is fetched by a top-level
  browser navigation (`window.location.href`), and a navigation cannot carry a custom header. The
  gate there would 426 every download from every client forever. It is removed from that route
  only — the gate exists to stop a stale client replaying queued COMMITs, which a read-only CSV of
  the job's own error rows cannot do; auth + owner + feature still apply.

## Hypothesis

The server owns the contract; the client's DTO must mirror what the route returns, and the fields
the UI consumes must be read from that shape (`res.job.id`, `res.job.commitToken`). Fixing the
consumer without fixing the type would leave the same trap for the next reader, so the type is
where the change belongs. The header name is a one-word correction to the SSOT the middleware
already defines.

## Failing test

src/features/import/__tests__/import-upload-contract.test.ts — feeds `uploadImport` the exact
envelope `POST /api/imports` returns (captured from create.route.ts) and asserts the caller can
reach the job id and commit token, plus that the request carries `X-Idempotency-Key`. Fails before
the fix: the id is undefined and the header is absent.

## Did I fix the symptom or the cause?

The cause. The symptom is one undefined field at one call site; the cause is a client DTO that
described a response nobody sends, which `api<T>()`'s assert-don't-check contract let through.
