# HisaabPro API Contract

> **Version:** 1.0
> **Date:** 2026-04-02
> **Stack:** Express + Prisma + PostgreSQL | React 19 Frontend
> **Base URL:** `https://api.hisaabpro.in/v1`

---

## Table of Contents

1. [Universal Response Format](#1-universal-response-format)
2. [Error Code Registry](#2-error-code-registry)
3. [Authentication Contract](#3-authentication-contract)
4. [Pagination Contract](#4-pagination-contract)
5. [API Versioning](#5-api-versioning)
6. [SSE Contract](#6-sse-contract)
7. [Idempotency Contract](#7-idempotency-contract)
8. [Rate Limits](#8-rate-limits)
9. [Webhook Contract (Outbound)](#9-webhook-contract-outbound)

---

## 1. Universal Response Format

Every API response follows a predictable envelope. No exceptions.

### Success Response (Single Resource)

```json
{
  "success": true,
  "data": {
    "id": "clxyz123",
    "name": "Sharma Dairy",
    "createdAt": "2026-04-02T10:30:00.000Z"
  }
}
```

### Success Response (List / Collection)

```json
{
  "success": true,
  "data": [
    { "id": "clxyz123", "name": "Sharma Dairy" },
    { "id": "clxyz456", "name": "Patel Stores" }
  ],
  "meta": {
    "page": {
      "cursor": "clxyz456",
      "hasNext": true,
      "hasPrevious": true,
      "totalCount": 142,
      "limit": 20
    }
  }
}
```

### Success Response (Action / No Body)

```json
{
  "success": true,
  "data": null
}
```

HTTP status: `204 No Content` for deletions (no body).

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "HP-400-001",
    "message": "Validation failed",
    "details": [
      {
        "field": "phone",
        "reason": "Must be a valid 10-digit Indian mobile number",
        "received": "12345"
      }
    ]
  }
}
```

### Response Rules

| Rule | Detail |
|------|--------|
| `success` | Always present. `true` or `false`. |
| `data` | Present on success. Object, array, or `null`. |
| `meta.page` | Present only on paginated list responses. |
| `error` | Present only on failure. Never alongside `data`. |
| `error.code` | Machine-readable. Format: `HP-{STATUS}-{SEQ}`. |
| `error.message` | Human-readable English string. |
| `error.details` | Optional array of field-level issues. |
| Timestamps | ISO 8601 with timezone (`Z` for UTC). |
| IDs | Prisma CUID strings. |
| Money | Integer paisa (100 = Rs 1). Field suffix: `Paisa`. |

---

## 2. Error Code Registry

Format: `HP-{HTTP_STATUS}-{SEQUENCE}`

### 400 -- Bad Request

| Code | Name | When |
|------|------|------|
| `HP-400-001` | VALIDATION_FAILED | Request body / query fails Zod schema |
| `HP-400-002` | BAD_FORMAT | Malformed JSON, invalid Content-Type, unparseable body |
| `HP-400-003` | INSUFFICIENT_STOCK | Product quantity exceeds available stock |
| `HP-400-004` | CREDIT_LIMIT_EXCEEDED | Transaction would push party beyond credit limit |
| `HP-400-005` | DUPLICATE_ENTRY | Unique constraint violated (phone, GSTIN, invoice number) |
| `HP-400-006` | INVALID_DATE_RANGE | `startDate` is after `endDate`, or date is in the future when not allowed |
| `HP-400-007` | AMOUNT_MISMATCH | Line items total does not match declared total |
| `HP-400-008` | INVALID_ENUM | Value not in allowed enum set |
| `HP-400-009` | FILE_TOO_LARGE | Upload exceeds size limit |
| `HP-400-010` | UNSUPPORTED_FILE_TYPE | File MIME type not in allow-list |

### 401 -- Unauthorized

| Code | Name | When |
|------|------|------|
| `HP-401-001` | TOKEN_EXPIRED | Access token past expiry |
| `HP-401-002` | TOKEN_BLACKLISTED | Token revoked (logout, password change) |
| `HP-401-003` | TOKEN_INVALID | Malformed or tampered JWT |
| `HP-401-004` | ACCOUNT_SUSPENDED | Admin-suspended account |
| `HP-401-005` | ACCOUNT_LOCKED | Too many failed OTP attempts |
| `HP-401-006` | SESSION_REVOKED | Session terminated from another device |
| `HP-401-007` | CAPTCHA_REQUIRED | Suspicious activity, CAPTCHA verification needed |
| `HP-401-008` | OTP_EXPIRED | One-time password past validity window |
| `HP-401-009` | OTP_INVALID | Wrong OTP code |
| `HP-401-010` | NO_CREDENTIALS | Missing Cookie / Authorization header entirely |

### 402 -- Payment Required

| Code | Name | When |
|------|------|------|
| `HP-402-001` | UPGRADE_REQUIRED | Feature requires a higher plan |
| `HP-402-002` | INVOICE_QUOTA_EXCEEDED | Monthly invoice limit reached for current plan |
| `HP-402-003` | USER_QUOTA_EXCEEDED | Max team members reached for current plan |
| `HP-402-004` | PRODUCT_QUOTA_EXCEEDED | Max products reached for current plan |
| `HP-402-005` | SUBSCRIPTION_EXPIRED | Subscription lapsed, renewal required |
| `HP-402-006` | BUSINESS_QUOTA_EXCEEDED | Max businesses reached for current plan |
| `HP-402-007` | STORAGE_QUOTA_EXCEEDED | File storage limit reached |

### 403 -- Forbidden

| Code | Name | When |
|------|------|------|
| `HP-403-001` | PERMISSION_DENIED | User lacks required role/permission for this action |
| `HP-403-002` | BUSINESS_INACTIVE | Business is archived or deactivated |
| `HP-403-003` | OWNER_ONLY | Action restricted to business owner |
| `HP-403-004` | CSRF_FAILED | Missing or invalid `X-CSRF-Token` |
| `HP-403-005` | MEMBERSHIP_REQUIRED | User is not a member of the target business |
| `HP-403-006` | IP_BLOCKED | Request from blocked IP range |
| `HP-403-007` | FEATURE_DISABLED | Feature flag is off for this business/plan |

### 404 -- Not Found

| Code | Name | When |
|------|------|------|
| `HP-404-001` | RESOURCE_NOT_FOUND | Entity with given ID does not exist or is soft-deleted |
| `HP-404-002` | ROUTE_NOT_FOUND | No handler matches the request path |
| `HP-404-003` | BUSINESS_NOT_FOUND | Business ID in path/header does not resolve |

### 409 -- Conflict

| Code | Name | When |
|------|------|------|
| `HP-409-001` | CONFLICT | Generic conflict (e.g., state transition not allowed) |
| `HP-409-002` | OFFLINE_SYNC_CONFLICT | Client offline mutation conflicts with server state |
| `HP-409-003` | DUPLICATE_REQUEST | Idempotency key already processed with different payload |
| `HP-409-004` | CONCURRENT_MODIFICATION | `updatedAt` mismatch -- another client modified the resource |
| `HP-409-005` | INVOICE_ALREADY_PAID | Attempting to modify a fully-settled invoice |

### 429 -- Too Many Requests

| Code | Name | When |
|------|------|------|
| `HP-429-001` | API_RATE_LIMIT | General API rate limit exceeded |
| `HP-429-002` | AUTH_RATE_LIMIT | Too many login/OTP requests |
| `HP-429-003` | SENSITIVE_ACTION_RATE_LIMIT | Too many password resets, exports, bulk deletes |

Response includes `Retry-After` header (seconds).

### 500 -- Internal Server Error

| Code | Name | When |
|------|------|------|
| `HP-500-001` | INTERNAL_ERROR | Unhandled exception (details hidden from client) |
| `HP-500-002` | DATABASE_ERROR | Prisma / PostgreSQL failure |
| `HP-500-003` | EXTERNAL_SERVICE_ERROR | Third-party API failure (SMS gateway, payment provider) |
| `HP-500-004` | TEMPLATE_RENDER_ERROR | PDF/invoice template rendering failed |

**Rule:** 5xx errors never expose stack traces or internal details to the client. They are logged server-side with a correlation ID returned as `error.details[0].traceId`.

---

## 3. Authentication Contract

### Token Flow

```
1. Client sends phone number
   POST /auth/otp/send  { "phone": "9876543210" }

2. Server sends OTP via SMS, returns:
   { "success": true, "data": { "otpId": "...", "expiresIn": 300 } }

3. Client verifies OTP
   POST /auth/otp/verify  { "otpId": "...", "otp": "123456" }

4. Server sets httpOnly cookies and returns user + businesses:
   Set-Cookie: hp_access=<JWT>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
   Set-Cookie: hp_refresh=<opaque>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000
   Set-Cookie: hp_csrf=<token>; Secure; SameSite=Strict; Path=/; Max-Age=900

   {
     "success": true,
     "data": {
       "user": { "id": "...", "phone": "9876543210", "name": "Sawan" },
       "businesses": [ { "id": "...", "name": "Sharma Dairy", "role": "OWNER" } ]
     }
   }

5. Client includes cookies automatically on every request.
   Mutating requests (POST/PUT/PATCH/DELETE) must include X-CSRF-Token header.

6. Token refresh (automatic, client-side interceptor):
   POST /auth/refresh  (hp_refresh cookie sent automatically)
   Server rotates both access and refresh tokens (cookies re-set).

7. Logout:
   POST /auth/logout
   Server blacklists refresh token, clears cookies.
```

### Token Details

| Token | Storage | Lifetime | Purpose |
|-------|---------|----------|---------|
| Access (`hp_access`) | httpOnly cookie | 15 minutes | API authentication |
| Refresh (`hp_refresh`) | httpOnly cookie | 30 days | Silent token renewal |
| CSRF (`hp_csrf`) | Readable cookie | 15 minutes (rotates with access) | CSRF protection |

### Required Headers

| Header | Required | When | Purpose |
|--------|----------|------|---------|
| `Cookie` | Always | Every request | Carries `hp_access` + `hp_refresh` |
| `X-CSRF-Token` | Mutating | POST, PUT, PATCH, DELETE | CSRF protection. Value from `hp_csrf` cookie. |
| `X-Idempotency-Key` | Conditional | POST (creates), financial mutations | Prevents duplicate processing. UUIDv4. |
| `X-Request-Nonce` | Conditional | Sensitive actions (payments, exports) | Replay protection. Single-use. |
| `X-Business-Id` | Always (after auth) | All business-scoped endpoints | Identifies active business context |
| `Accept` | Recommended | Every request | API version negotiation (see section 5) |
| `Content-Type` | When body exists | POST, PUT, PATCH | Must be `application/json` unless file upload |

### Session Rules

- Max 3 concurrent sessions per user (oldest revoked on 4th login).
- Refresh token rotation: each refresh invalidates the previous refresh token.
- If a revoked refresh token is used, ALL sessions for that user are terminated (theft detection).

---

## 4. Pagination Contract

All list endpoints use **cursor-based pagination**.

### Query Parameters

| Param | Type | Default | Constraints | Description |
|-------|------|---------|-------------|-------------|
| `cursor` | `string` | `undefined` | Valid CUID | ID of last item from previous page. Omit for first page. |
| `limit` | `integer` | `20` | `1` -- `100` | Items per page |
| `sortBy` | `string` | `createdAt` | Resource-specific allowed fields | Sort field |
| `sortOrder` | `asc \| desc` | `desc` | -- | Sort direction |
| `search` | `string` | `undefined` | Max 100 chars | Full-text search across searchable fields |

### Response Shape

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": {
      "cursor": "clxyz456",
      "hasNext": true,
      "hasPrevious": true,
      "totalCount": 142,
      "limit": 20
    }
  }
}
```

- `cursor` -- ID of the last item in the current page. Pass as `?cursor=` for the next page.
- `totalCount` -- Total matching items (computed only if `?count=true` is passed, otherwise omitted for performance).

### Filtering Examples by Resource

**Parties**

```
GET /parties?search=sharma&type=CUSTOMER&sortBy=balance&sortOrder=desc&limit=25
```

**Invoices**

```
GET /invoices?partyId=clxyz123&status=UNPAID&fromDate=2026-01-01&toDate=2026-03-31&cursor=clinv789&limit=50
```

**Products**

```
GET /products?category=DAIRY&search=paneer&lowStock=true&sortBy=name&sortOrder=asc
```

**Transactions / Payments**

```
GET /transactions?partyId=clxyz123&type=PAYMENT_IN&fromDate=2026-03-01&toDate=2026-03-31&minAmount=10000&maxAmount=500000
```

**Stock Adjustments**

```
GET /stock-adjustments?productId=clprod456&type=DECREASE&fromDate=2026-03-01
```

### Pagination Rules

1. Never use offset-based pagination. Cursor pagination avoids skipping/duplicating rows on concurrent inserts.
2. If `cursor` is invalid or points to a deleted record, return `HP-400-001` with detail: `"Invalid cursor"`.
3. Empty results return `data: []` with `hasNext: false`, not `404`.

---

## 5. API Versioning

### Strategy: Accept Header Versioning

```
Accept: application/json; version=1
```

- If no `Accept` header or no `version` parameter is specified, the server defaults to the **current stable version**.
- Version is an integer, incremented only on breaking changes.

### Version Lifecycle

| Stage | Duration | Behavior |
|-------|----------|----------|
| **Current** | Indefinite (until next major) | Default. Full support. |
| **Deprecated** | 6 months minimum | Works, but response includes `X-HP-Deprecated: true` and `Sunset` header. |
| **Sunset** | 1 month | Returns `HP-400-002` with migration instructions in `error.details`. |
| **Removed** | -- | Returns `HP-404-002`. |

### Breaking vs Non-Breaking Changes

**Breaking (requires version bump):**
- Removing or renaming a response field
- Changing a field's type
- Removing an endpoint
- Changing required request parameters
- Changing authentication scheme
- Altering error code semantics

**Non-Breaking (no version bump):**
- Adding a new optional response field
- Adding a new endpoint
- Adding a new optional query parameter
- Adding a new error code
- Increasing rate limits
- Adding new enum values (if clients handle unknown values)

### Response Headers

```
X-HP-API-Version: 1
X-HP-Deprecated: true          // only if using deprecated version
Sunset: Sat, 01 Nov 2026 00:00:00 GMT  // only if deprecated
```

---

## 6. SSE Contract

### Connection

```
GET /sse/events
Headers:
  Cookie: hp_access=<JWT>
  X-Business-Id: <businessId>
  Accept: text/event-stream
```

Connection is per-business. The server validates the access token and business membership before upgrading to SSE.

### Event Format

```
id: evt_clxyz789
event: INVOICE_CREATED
data: {"id":"clinv123","invoiceNumber":"INV-2026-042","partyId":"clpty456","totalPaisa":150000,"createdBy":"clusr789","timestamp":"2026-04-02T14:30:00.000Z"}

```

Each event has:
- `id` -- Unique event ID. Client sends `Last-Event-ID` on reconnect to resume.
- `event` -- Event type string.
- `data` -- JSON payload. Always includes `id`, `timestamp`, and `createdBy`/`updatedBy`.

### Event Types

#### Documents

| Event | Payload Key Fields |
|-------|--------------------|
| `DOCUMENT_CREATED` | `id`, `type` (INVOICE/QUOTATION/DELIVERY_CHALLAN/PURCHASE_ORDER), `number`, `partyId`, `totalPaisa` |
| `DOCUMENT_UPDATED` | `id`, `type`, `changes` (array of changed field names), `updatedBy` |
| `DOCUMENT_DELETED` | `id`, `type`, `deletedBy` |

#### Payments

| Event | Payload Key Fields |
|-------|--------------------|
| `PAYMENT_RECEIVED` | `id`, `partyId`, `amountPaisa`, `mode` (CASH/UPI/BANK/CHEQUE) |
| `PAYMENT_SENT` | `id`, `partyId`, `amountPaisa`, `mode` |
| `PAYMENT_UPDATED` | `id`, `changes`, `updatedBy` |
| `PAYMENT_DELETED` | `id`, `deletedBy` |

#### Party

| Event | Payload Key Fields |
|-------|--------------------|
| `PARTY_CREATED` | `id`, `name`, `type` (CUSTOMER/SUPPLIER), `phone` |
| `PARTY_UPDATED` | `id`, `changes`, `updatedBy` |
| `PARTY_DELETED` | `id`, `deletedBy` |
| `PARTY_BALANCE_CHANGED` | `id`, `previousBalancePaisa`, `newBalancePaisa`, `reason` |

#### Product

| Event | Payload Key Fields |
|-------|--------------------|
| `PRODUCT_CREATED` | `id`, `name`, `category`, `pricePaisa` |
| `PRODUCT_UPDATED` | `id`, `changes`, `updatedBy` |
| `PRODUCT_DELETED` | `id`, `deletedBy` |

#### Stock

| Event | Payload Key Fields |
|-------|--------------------|
| `STOCK_ADJUSTED` | `id`, `productId`, `type` (INCREASE/DECREASE), `quantity`, `reason` |
| `STOCK_LOW_ALERT` | `productId`, `currentQuantity`, `minimumQuantity` |

#### Settings

| Event | Payload Key Fields |
|-------|--------------------|
| `SETTINGS_UPDATED` | `section` (BUSINESS/INVOICE/TAX/PRINT), `changes`, `updatedBy` |

#### Subscription

| Event | Payload Key Fields |
|-------|--------------------|
| `SUBSCRIPTION_ACTIVATED` | `planId`, `planName`, `expiresAt` |
| `SUBSCRIPTION_EXPIRING` | `planId`, `expiresAt`, `daysRemaining` |
| `SUBSCRIPTION_EXPIRED` | `planId`, `expiredAt` |
| `SUBSCRIPTION_UPGRADED` | `previousPlanId`, `newPlanId`, `newPlanName` |

### Client Behavior

1. **Connect** on app mount with `EventSource` or fetch-based SSE client.
2. **Store `Last-Event-ID`** in memory. Send on reconnect.
3. **Auto-reconnect** with exponential backoff: 1s, 2s, 4s, 8s, max 30s.
4. **Heartbeat**: Server sends `:heartbeat\n\n` every 30 seconds. If no heartbeat for 60s, client should reconnect.
5. **Update local state** optimistically. On SSE event from another user/device, merge into local cache.
6. **Ignore own events**: Each event includes `createdBy`/`updatedBy`. Client skips events it triggered (match against current user ID).
7. **Token refresh**: On `401` during SSE, close stream, refresh token, reconnect.

---

## 7. Idempotency Contract

### Which Endpoints Require Idempotency

| Method | Endpoints | Required |
|--------|-----------|----------|
| POST | All creation endpoints (`/invoices`, `/payments`, `/parties`, `/products`) | Yes |
| POST | `/auth/*` | No |
| PUT / PATCH | All update endpoints | No (naturally idempotent) |
| DELETE | All deletion endpoints | No (naturally idempotent) |
| POST | Financial mutations (`/payments/record`, `/invoices/settle`) | Yes |
| POST | Bulk operations (`/*/bulk-delete`, `/*/bulk-update`) | Yes |

### Client Behavior

1. Generate a `UUIDv4` per user action (not per retry).
2. Send as `X-Idempotency-Key: <uuid>` header.
3. On network failure / timeout, retry with the **same** key.
4. On `HP-409-003` (duplicate request with different payload), generate a new key -- the previous action already completed.
5. Never reuse a key across different actions.

```javascript
// Client example
const idempotencyKey = crypto.randomUUID();

const createInvoice = async (data, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * Math.pow(2, i));
    }
  }
};
```

### Server Behavior

```
1. Receive request with X-Idempotency-Key
2. Check idempotency store (Redis key: `idem:{businessId}:{key}`)
   a. Key exists with SAME payload hash -> return cached response (200)
   b. Key exists with DIFFERENT payload hash -> return HP-409-003
   c. Key does not exist -> continue to step 3
3. Process request within a database transaction
4. On success:
   - Store in Redis: { key, payloadHash, response, statusCode }
   - TTL: 24 hours
   - Return response to client
5. On failure:
   - Do NOT cache the error (allow retry)
   - Return error to client
```

### Idempotency Rules

- Keys are scoped per business (`businessId` + `key`).
- TTL is 24 hours. After that, the same key can be reused (but should not be).
- `GET` and `DELETE` requests ignore the idempotency header.
- The server returns `HP-400-001` if `X-Idempotency-Key` is required but missing.

---

## 8. Rate Limits

All limits are enforced per business unless noted. Responses include rate limit headers.

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1743580800
```

### Rate Limit Table

| Endpoint Category | Limit | Window | Scope | Error Code |
|-------------------|-------|--------|-------|------------|
| General API | 100 req | 1 minute | Per business | `HP-429-001` |
| List / Read endpoints | 200 req | 1 minute | Per business | `HP-429-001` |
| Create / Update / Delete | 60 req | 1 minute | Per business | `HP-429-001` |
| OTP send | 5 req | 15 minutes | Per phone number | `HP-429-002` |
| OTP verify | 10 req | 15 minutes | Per phone number | `HP-429-002` |
| Login attempts | 10 req | 15 minutes | Per IP | `HP-429-002` |
| Password/PIN reset | 3 req | 1 hour | Per user | `HP-429-003` |
| PDF export | 20 req | 1 hour | Per business | `HP-429-003` |
| Bulk operations | 10 req | 1 hour | Per business | `HP-429-003` |
| Data export (CSV/Excel) | 5 req | 1 hour | Per business | `HP-429-003` |
| File upload | 30 req | 1 hour | Per business | `HP-429-001` |
| SSE connection | 3 connections | Concurrent | Per user | `HP-429-001` |
| Webhook delivery retry | 5 retries | Per event | Per endpoint | N/A (server-side) |

### Burst Allowance

- General API allows a burst of 20 requests above the limit within a 5-second window before throttling.
- Auth endpoints have no burst allowance.

### Exceeded Behavior

- Response: `429 Too Many Requests` with `Retry-After` header (seconds until reset).
- Persistent abuse (10x sustained over-limit): IP temporarily blocked for 1 hour with `HP-403-006`.

---

## 9. Webhook Contract (Outbound)

> **Status:** Future feature. Contract defined for forward compatibility.

### Overview

Businesses on Pro/Enterprise plans can register webhook URLs to receive real-time event notifications for integrations (accounting software, ERP, custom dashboards).

### Registration

```
POST /webhooks
{
  "url": "https://example.com/hooks/hisaabpro",
  "events": ["INVOICE_CREATED", "PAYMENT_RECEIVED"],
  "secret": "whsec_user_provided_or_auto_generated"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "clwhk123",
    "url": "https://example.com/hooks/hisaabpro",
    "events": ["INVOICE_CREATED", "PAYMENT_RECEIVED"],
    "status": "ACTIVE",
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

### Event Types

All SSE event types (section 6) are available as webhook events. Additionally:

| Event | Description |
|-------|-------------|
| `WEBHOOK_TEST` | Sent when user clicks "Test webhook" in settings |
| `REPORT_GENERATED` | Scheduled report (daily/weekly/monthly) completed |
| `BACKUP_COMPLETED` | Automated data backup finished |

### Payload Format

```json
{
  "id": "evt_clxyz789",
  "type": "INVOICE_CREATED",
  "businessId": "clbiz123",
  "timestamp": "2026-04-02T14:30:00.000Z",
  "data": {
    "id": "clinv123",
    "invoiceNumber": "INV-2026-042",
    "partyId": "clpty456",
    "totalPaisa": 150000
  }
}
```

### Signature Verification

Every webhook request includes a signature header for payload verification:

```
X-HP-Webhook-Signature: sha256=<hex_digest>
X-HP-Webhook-Timestamp: 1743580800
X-HP-Webhook-ID: evt_clxyz789
```

Signature is computed as:

```
HMAC-SHA256(
  key: webhook_secret,
  message: "${timestamp}.${JSON.stringify(body)}"
)
```

**Verification (recipient server):**

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, headers, secret) {
  const timestamp = headers['x-hp-webhook-timestamp'];
  const signature = headers['x-hp-webhook-signature'].replace('sha256=', '');

  // Reject if timestamp is older than 5 minutes (replay protection)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

### Delivery Behavior

| Property | Value |
|----------|-------|
| Method | `POST` |
| Content-Type | `application/json` |
| Timeout | 10 seconds |
| Retries | 5 (exponential backoff: 30s, 2m, 10m, 1h, 6h) |
| Success | Any `2xx` response |
| Failure threshold | 50 consecutive failures -> webhook auto-disabled, owner notified |
| Event ordering | Best-effort. Use `timestamp` for ordering, not delivery order. |
| Deduplication | Recipient should deduplicate by `id` (same event may be delivered more than once). |

### Webhook Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhooks` | List registered webhooks |
| POST | `/webhooks` | Register a new webhook |
| PATCH | `/webhooks/:id` | Update URL, events, or status |
| DELETE | `/webhooks/:id` | Remove a webhook |
| POST | `/webhooks/:id/test` | Send a test event |
| GET | `/webhooks/:id/deliveries` | View delivery history and failures |

---

## Appendix: Standard HTTP Status Codes Used

| Status | Meaning | When |
|--------|---------|------|
| `200` | OK | Successful read, update, or idempotent replay |
| `201` | Created | Successful resource creation |
| `204` | No Content | Successful deletion |
| `400` | Bad Request | Validation, format, business rule violation |
| `401` | Unauthorized | Authentication failure |
| `402` | Payment Required | Plan/quota limitation |
| `403` | Forbidden | Authorization failure |
| `404` | Not Found | Resource or route missing |
| `409` | Conflict | State conflict, duplicate, concurrent edit |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side failure |

---

*This document is the single source of truth for HisaabPro API behavior. All backend routes and frontend API clients must conform to these contracts. Any deviation is a bug.*
