# Security Audit — Epic C (Invite / Public-Token Share / Multi-Tenant Claim)

- Status: **CONDITIONAL PASS**
- Auditor: security agent
- Date: 2026-05-14
- Plan: `.claude/design-plan-active.md` (created 2026-05-14T14:14:00Z)
- Scope: invite issuance, public-link tokens, claim flow, tenant-scoping on claimed entities, OTP/email verification on existing-user claim, slug/handle hygiene.

This audit is a **mandatory gate artifact** referenced by the high-risk-path
gate (`~/.claude/hooks/check-plan-required.cjs`). The verdict is **CONDITIONAL
PASS**: Epic C may proceed only after the FAIL findings below are resolved
by the architect and re-verified.

---

## Verdict

**CONDITIONAL PASS** — 7 FAILs must be fixed before any implementation work
begins on the affected modules. WARN/VERIFY items must be answered in the
architect's revision but do not by themselves block. After fixes land, this
file should be re-stamped (mtime ≥ plan `created:`) so the gate continues to
pass.

---

## FAIL findings (BLOCKERs)

### A2 — Invite/share tokens stored in plaintext at rest
- **Where:** `prisma/schema.prisma` — `Invite.token` and `ShareLink.token` columns
  in the proposed Epic C migration.
- **Risk:** A DB read (backup leak, read-replica compromise, support-tooling
  query, log spill) yields working bearer tokens for every outstanding
  invite/share. Mirrors the password-at-rest anti-pattern.
- **Fix:** Store `tokenHash` (SHA-256 of the high-entropy token) and a short
  `tokenLookupPrefix` (first 8 chars) for indexed lookup. The plaintext token
  exists only in the URL handed to the recipient. Server compares
  `timingSafeEqual(sha256(submitted), row.tokenHash)`.
- **Reuse:** DudhHisaab `services/auth.refresh.ts` already does exactly this
  pattern for refresh tokens — adapt.

### A5 / C3 / F3 — Claim flow is not an atomic claim (TOCTOU + double-claim)
- **Where:** Proposed `claimInvite()` / `claimShareLink()` service flow —
  reads the invite row, validates, then in a separate statement marks it
  consumed and creates the membership.
- **Risk:** Two concurrent requests (or one request + one retry) both pass
  validation, both create memberships, both mark consumed. Result: duplicate
  rows, duplicate tenant grants, audit log shows a single consumer.
- **Fix:** Single transaction with a conditional UPDATE:
  ```sql
  UPDATE invites
     SET consumed_at = now(), consumed_by = $userId
   WHERE id = $id AND consumed_at IS NULL AND expires_at > now()
   RETURNING *;
  ```
  If `rowCount = 0`, reject. Membership insert happens in the same tx and
  rolls back on conflict. No service-layer "read then write" gap.

### C2 — `resolvePublicToken` helper bypasses tenant scoping
- **Where:** Proposed `lib/public-token.ts` `resolvePublicToken(token)` returns
  `{ resourceType, resourceId, scopes }` and downstream handlers do
  `prisma.invoice.findUnique({ where: { id: resourceId } })`.
- **Risk:** Classic IDOR via token-to-id substitution. The token validates,
  the handler trusts the id, but nothing re-checks that the resolved
  `resourceId` actually belongs to the workspace the token was issued for.
  An attacker who learns *any* invoice id under a workspace with a valid
  share token can read it.
- **Fix:** `resolvePublicToken` must return a **prisma scope object**
  (`{ workspaceId, allowedResourceIds }` or a `where` fragment) that every
  downstream query MUST merge in. Handlers never accept a raw id from the
  URL — they accept the token, the helper produces the scoped query, the
  query returns the row or 404. Wrap in a typed `PublicQueryScope` so a
  reviewer can grep for `prisma.X.findFirst({ where: { ...scope, ... } })`.

### E1 — Request bodies use `.passthrough()` / shallow Zod
- **Where:** Architect draft of `POST /invites` and `POST /claim` Zod schemas
  uses inferred shapes without `.strict()` and references `data: req.body`
  in the service.
- **Risk:** Mass assignment. A caller can post `{ role: 'OWNER', workspaceId:
  '<victim>' }` and ride the spread into Prisma. This is the same class of
  bug we already block in the codebase via `dudhhisaab/no-zod-passthrough`
  and the `data: req.body` pattern check in `enforce.js`.
- **Fix:** Every schema `.strict()`. Service builds an explicit allowlist
  object literal (`{ email: dto.email, role: dto.role }`) — never spreads
  `req.body` into Prisma `data:`. Role is constrained to a Zod enum that
  excludes `OWNER` on the invite path (only the workspace creator may be
  owner; owner-transfer is a separate, audited flow).

### F2 — Existing-user invite-claim skips OTP / re-auth
- **Where:** Proposed `POST /claim` accepts the invite token + a logged-in
  session and creates the membership immediately.
- **Risk:** If the user's session cookie is captured (XSS on another tab,
  shared device, stolen laptop), the attacker can silently join any
  workspace they're invited to and exfiltrate data. The invite link is the
  *only* second factor and it sits in the victim's email — already assumed
  compromised in the threat model that motivates invites.
- **Fix:** For existing users, claim requires a fresh OTP to the *invitee
  email* (the email the invite was issued to, NOT the session user's
  primary email — they may differ). Reuse the DudhHisaab crypto-OTP +
  `timingSafeEqual` flow. New-user claim already does email verification
  by definition (they set the password from the link), so this only
  applies to the "already logged in" branch.

### H1 — Workspace slug allows reserved/admin names
- **Where:** Proposed `Workspace.slug` validation.
- **Risk:** Users can claim `admin`, `api`, `auth`, `login`, `assets`,
  `static`, `webhooks`, `_health`, `superadmin`, `hisaabpro` as their
  workspace slug. Result: `hisaabpro.in/admin` resolves to a tenant page,
  breaks routing, enables phishing.
- **Fix:** Reserved-slug list checked at create time and at rename time.
  List lives in `lib/reserved-slugs.ts` and includes: every top-level
  route segment used by the app, every auth/admin/api/health/static path,
  and a curated brand list (`hisaabpro`, `dudhhisaab`, `support`, `help`,
  `billing`, `pay`, `invoice`). Reject with 422 + clear error.

### H3 — Slug regex permits unicode lookalikes
- **Where:** Proposed regex `/^[\p{L}\p{N}-]{3,40}$/u`.
- **Risk:** Homograph attacks — `аdmin` (Cyrillic а) registers as a distinct
  slug from `admin` but renders identically. Phishing surface.
- **Fix:** ASCII-only: `/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/`. Lowercase
  only, no leading/trailing hyphen, no double hyphen (add separate check),
  length 3–40. If we ever want non-Latin display names, that's a separate
  `displayName` field — the slug stays ASCII.

---

## WARN / VERIFY (must be answered in the architect revision, not blockers)

- **W1 — Token entropy:** Spec must state ≥ 256 bits (`crypto.randomBytes(32)`,
  base64url). Anything less risks online guessing on the lookup prefix.
- **W2 — Rate-limit on claim:** `POST /claim` and `POST /invites/:id/resend`
  must be rate-limited per-IP AND per-account (existing limiter). Architect
  did not specify limits — add to the design.
- **W3 — Invite expiry:** Default 7 days, hard max 30. Architect draft says
  "configurable" — pin a max so an admin cannot accidentally issue an
  effectively-permanent invite.
- **W4 — Webhook on claim:** If Epic C emits a webhook on `invite.claimed`,
  it MUST follow `memory/security_defaults.md` rules (HMAC on raw buffer,
  `event_id`, ≤ 5 min skew). Confirm whether such a webhook exists.
- **W5 — `req.user.userId` vs `req.user.id`:** New invite/claim handlers must
  match the canonical shape — confirm which is used in HisaabPro
  (`memory/auth_req_user_shape.md` calls this out for DudhHisaab; HP may
  differ). One audit-pass after impl to verify no `.id` typo leaks an
  UNAUTHORIZED.
- **W6 — Audit log:** Every claim, invite issuance, invite revoke, share-link
  create/revoke must write an audit row with actor, target workspace,
  resource, IP, UA. Architect draft mentions audit "TBD" — must be in v1.
- **W7 — CSRF on `/claim`:** Cookie-auth state-change; ensure middleware
  applies (Origin/Referer check). Not on the skip-allowlist.
- **W8 — Frontend storage:** Invite token from URL must NOT be persisted to
  `localStorage` (ESLint rule already blocks `authToken`, extend to
  `inviteToken` / `shareToken` keys for clarity).

---

## Required architecture changes (architect must revise before code starts)

1. Replace `Invite.token` / `ShareLink.token` columns with `tokenHash` +
   `tokenLookupPrefix`. Update migration sequence in `ARCHITECTURE.md`.
2. Add a `claimInvite` transaction spec (single conditional UPDATE +
   membership insert) — replace the read-then-write service draft.
3. Introduce `lib/public-token.ts` `resolvePublicToken` that returns a
   `PublicQueryScope` (workspace-scoped where-fragment), not a bare
   resource id. Update every public-link handler signature accordingly.
4. All invite/claim Zod schemas marked `.strict()`; service files build
   explicit Prisma `data:` allowlists. No `req.body` spread.
5. Add OTP-on-claim step for the existing-user branch; design the OTP
   transport (email to invitee address, not session user's email).
6. Add `lib/reserved-slugs.ts` and integrate into both create and rename
   workspace flows; lock slug regex to ASCII-only.
7. Specify token entropy (32 bytes), invite TTL (default 7 d, max 30 d),
   and rate-limit numbers for `/invites`, `/invites/:id/resend`, `/claim`.
8. Add audit-log table writes to every Epic C mutation; list the fields.
9. Confirm `req.user` shape in HP and document in `ARCHITECTURE.md` so
   handlers don't regress on the DudhHisaab `.id` vs `.userId` footgun.
10. Confirm whether `invite.claimed` emits a webhook; if yes, the webhook
    section of `security_defaults.md` applies in full.

---

## Sign-off

Re-stamp this file (`touch docs/SECURITY_AUDIT_EPIC_C.md`) once the architect's
revised `ARCHITECTURE.md` addresses items 1–10 above. The gate validates
mtime ≥ plan `created:`, so a stale audit will not satisfy a new plan version —
the architect must re-invoke security after revising.
