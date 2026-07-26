---
symptom: After creating a second business (Settings → Create business) the owner cannot invite staff — the Roles dropdown is permanently empty and the server answers 400 "Related record not found (foreign key constraint)" on GET /businesses/:id/roles.
root_cause_file: src/features/business/useCreateBusiness.ts:36
root_cause_reason: Creating (and joining) a business never activates it in the session, so the JWT still carries the old — for a fresh account, empty — businessId, and every route that reads req.user.businessId works against a business that does not exist.
---

## 5-whys

1. **Why is the Roles dropdown empty?** `GET /businesses/:id/roles` answers 400,
   so `useStaffInvite` catches, leaves `roles` at `[]`, and the select opens with
   nothing in it. The E2E case then waits forever for an option to click.
2. **But why does that endpoint 400?** `listRoles` calls `ensureSystemRoles`,
   whose `role.upsert` violates `Role_businessId_fkey`. The businessId it is
   writing does not exist in `Business`. (Run against the same database by hand,
   with the real id, the same upsert succeeds — so the id is what differs.)
3. **But why is the businessId wrong when the URL carries the right one?**
   `server/src/routes/settings.ts:69` reads `req.user!.businessId` — the token
   claim, not `req.params.businessId`. That is deliberate (the param is checked
   to match elsewhere); the claim is the tenant of record.
4. **But why is the claim wrong?** The token was minted at registration, before
   the account had any business, so the claim is `''`. `POST /businesses` creates
   the row and returns; nothing re-mints the session. `GET /auth/me` still looks
   healthy because it derives `activeBusiness` from the membership rows, not from
   the claim — so the UI renders while every scoped route is looking at `''`.
5. **But why was the activation left out here when it exists?**
   `useOnboarding.ts:102` does it, with a comment explaining exactly this trap.
   The knowledge lived in one call-site instead of in the operation. Two later
   call-sites — create-a-second-business and join-by-invite — re-implemented
   "acquire a business" without it, and neither had a way to know.

## Hypothesis

Acquiring a business and activating it are not two steps a caller may choose to
combine; the second is what makes the first usable, and every consumer needs it.
Put both behind one module — `src/features/business/business-session.service.ts`
— and have onboarding, create-business and join-by-invite call that. The
activation itself stays where it already is (`POST /auth/switch-business`, which
mints the tokens and rotates the cookies): this change removes a duplicated
*omission*, it does not duplicate token minting.

Server-side activation inside `POST /businesses` was considered and rejected for
now: it would fork token issuance across two routes for a defect whose whole
shape is "three clients, one of them correct". Worth revisiting if a non-web
client ever creates businesses.

## Failing test

src/features/business/__tests__/business-session.service.test.ts
