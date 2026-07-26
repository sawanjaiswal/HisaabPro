---
symptom: A shopkeeper interrupted mid-setup (a call, a low-memory kill, an accidental reload) comes back to the welcome screen with every answer gone
root_cause_file: src/features/onboarding/OnboardingPage.tsx:30
root_cause_reason: The wizard's step and answers lived only in component `useState`, so the first unmount — a reload, a process kill, a back gesture — discarded the whole form with nothing written anywhere
---

## 5-whys

1. Why does a reload restart onboarding? — `OnboardingPage` mounts fresh with
   `useState<OnboardingStep>('welcome')` and `useOnboarding()`'s fields at `''`.
2. Why is nothing restored? — nothing is ever stored; the wizard writes to the server
   only at the last step, so everything before the final Continue is in-memory only.
3. Why does that matter more here than on other forms? — setup is the one form a
   shopkeeper cannot skip, and it runs on the cheapest phone they own, minutes after
   installing an app they do not trust yet. Losing it is where they quit.
4. Why wasn't a draft added? — the app already has the pattern (`useCampaignWizard`
   kept a sessionStorage draft), but it was written inline in that one hook, so it was
   invisible to anyone building the next wizard.
5. Why is that the root? — a pattern with no shared home gets re-derived or skipped.
   The fix is one storage contract every multi-step form reads from.

## Hypothesis

Extract the load/save/clear trio into `src/lib/session-draft.ts` (`createSessionDraft`)
— `sessionStorage`, best-effort, never throws, tolerates a corrupt payload — and have
onboarding own its step in the hook so step and answers persist together. `ready` is
never resumable: it asserts a business exists, which is the server's fact, not a
draft's. Creating the business clears the draft, so the add-a-second-business flow
starts blank. `useCampaignWizard` moves onto the same helper so the contract has one
implementation rather than two.

Honest limit: `sessionStorage` dies with the tab, so an Android process kill still
loses the draft. `localStorage` would survive it but OFFLINE_RULES rule 4 keeps entity
data out of it; a Dexie-backed draft is the only thing that would cover that case and
it is not worth the write cost for a five-field form.

## Failing test

e2e/gold/onboarding.spec.ts TC-ONB-07 — reload after typing the business name, expect
the wizard on the step the user left. Fails before the fix (the welcome screen renders).
TC-ONB-01 additionally guards the other direction: a second business starts blank.

## Did I fix the symptom or the cause?

The cause. The symptom is one lost form; the cause is wizard state with no persistence
contract, which is why the fix is a shared module and not a `useState` in one page.
