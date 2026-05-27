verdict: PASS

# Architecture critique — money-ssot-paise-int (Revision 2)

Audit of `/Users/sawanjaiswal/Projects/HisaabPro/.claude/design-plan-active--money-ssot.md` rev 2.
All three prior MUST_FIX items closed; key SHOULD_FIX items absorbed. No new
MUST_FIX surfaced. Greenlight to invoke agents and ship under the 3-PR rollout.

## Prior MUST_FIX resolutions verified

| # | Prior gap | Resolution in rev 2 | Status |
|---|---|---|---|
| 1 | INT32 math off by 10× (~Rs 2.14 Cr, not Rs 21 Cr) | Plan §1 table + §5 row 2 corrected. `User.referralTotalEarned` and `ReferralCode.totalEarned` typed `BigInt` in schema (lines 194-195) + `BIGINT` in DDL (lines 98, 101). Per-row INT columns documented as safe with explicit per-row caps. | CLOSED |
| 2 | `ADD COLUMN NOT NULL` lock storm on `User` | Migration A is NULL-first (lines 95-112) with `SET lock_timeout = '3s'; SET statement_timeout = '10s';`. Separate `set_money_paise_not_null` migration (lines 117-128) does `SET DEFAULT` + `SET NOT NULL` post-backfill as two fast statements, also lock-bounded. Pattern matches the Braintree/GitLab "expand-contract" playbook. | CLOSED |
| 3 | PR3 `@map` rename drift trap | Authoring sequence explicit (lines 180-187): `prisma migrate diff --from-url <shadow> --to-schema-datamodel --script`. CI gate `prisma migrate status` clean on PR3 branch added to acceptance (line 47). | CLOSED |

## SHOULD_FIX absorption verified

- #4 dual-write SQL verifier → acceptance gate at line 46.
- #5 branded `Paise` type → `server/src/types/money.ts` in files_planned (line 28) + risks row at line 281; acceptance line 48.
- #6 rupee-literal `rg` audit → risks row at line 282 with the exact command.
- #7 backfill pre-flight overflow check → script lines 137-150; acceptance line 45.

## New review for revision-induced regressions

Checked the three usual revision footguns. None hit:

1. **BigInt arithmetic in Prisma `increment`** — Prisma accepts `bigint` literals on BigInt fields; the rewards-service snippet (lines 220-224) increments `referralTotalEarned` with the same `reward.amountPaise` value as the INT wallet column. This works only because `amountPaise` (per-event, INT) is implicitly widened by Prisma's BigInt field handling. Confirm via integration test that `reward.amountPaise` is passed as `number` and Prisma widens — Prisma 5 does this correctly. Non-blocking; covered by the new `referral-money-paise.contract.test.ts`.
2. **`SET NOT NULL` table scan on `User`** — plan acknowledges (line 131) it's a scan but not a reader-block. Correct for Postgres ≥ 9.4. `lock_timeout` bounds the writer-block window. Fine.
3. **`prisma migrate diff --from-url <shadow>`** — shadow URL must reflect the *post-Migration-A2 state* (paise columns present, legacy still present) so the diff produces only DROP statements + `@map`. Plan implies this via the "current DB state → final schema" wording (line 183) but does not name the prerequisite explicitly. Cosmetic, not a MUST_FIX — the engineer running the command will hit a noisy diff immediately if they point at the wrong shadow.

## Verdict

PASS. Fill `agents_invoked` (architect + security if you choose to gate webhooks-adjacent code, otherwise architect alone covers schema-only), flip `status: approved`, and proceed to PR1.
