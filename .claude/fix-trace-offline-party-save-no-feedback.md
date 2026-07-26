---
symptom: Saving a party with no signal leaves the shopkeeper on the filled form with no confirmation, so they save again and queue a duplicate.
root_cause_file: src/features/parties/usePartyForm.ts:179
root_cause_reason: The submit handler dereferences the response of a mutation that api() resolves as `{}` when it queues the save offline, so reconcilePartyCreated throws and the toast + navigation that follow it never run.
---

## 5-whys

1. An offline save shows no toast and does not leave the form. But why?
2. `toast.success(...)` and `navigate(ROUTES.PARTIES)` sit after
   `reconcilePartyCreated(queryClient, created)`, which threw. But why did it
   throw?
3. It read `created.id`, and `created` was undefined. But why was it undefined?
4. `createParty` destructures `{ party }` out of the api() response, and api()
   resolves `{} as T` for a mutation it has queued — there is no party yet, by
   design. But why did the caller not expect that?
5. Because `createParty` is typed `Promise<PartyDetail>`, which is a lie the
   moment the queue is involved. Every caller is told a party always comes back,
   so both of them dereference it. OFFLINE_RULES rule 5 is written down but
   nothing in the types enforces it.

## Hypothesis

Make the service's type honest — `Promise<PartyDetail | null>`, `null` meaning
"queued, nothing to reconcile yet" — and the compiler forces both call-sites to
branch. Each then reconciles only when there is a record, and reports the save
the way the rest of the app already does (`useEmployees`, `useAppointmentMutations`):
success either way, with the "will sync when online" suffix when offline. The
change is safely in the queue; the user must be told so.

## Failing test

src/features/parties/__tests__/usePartyForm.offline.test.ts
