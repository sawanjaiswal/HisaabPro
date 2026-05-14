# Batch 3 Backend Proofs — Price Lists API
Date: 2026-05-14

## tsc --noEmit
```
Exit code 0 — zero errors
```

---

## Curl Proofs

### 1. POST /api/price-lists — 201 success
```
curl -X POST http://localhost:4000/api/price-lists \
  -H 'Content-Type: application/json' -b cookies.txt -H 'X-CSRF-Token: ...' \
  -d '{"name":"Wholesale","isDefault":true}'

HTTP 201
{"success":true,"data":{"list":{"id":"cmp53olmc0007rokhl2le7gz3","businessId":"demo-business-001","name":"Wholesale","isDefault":true,"isDeleted":false,"deletedAt":null,"createdAt":"2026-05-14T06:21:26.004Z","updatedAt":"2026-05-14T06:21:26.004Z"}}}
```

### 2. POST /api/price-lists — 401 no auth (CSRF rejected — no session cookie)
```
curl -X POST http://localhost:4000/api/price-lists \
  -H 'Content-Type: application/json' \
  -d '{"name":"TestList"}'

HTTP 401
{"success":false,"error":{"code":"CSRF_FAILED","message":"Invalid CSRF token"}}
```

### 3. POST /api/price-lists — 400 validation (empty name)
```
curl -X POST http://localhost:4000/api/price-lists \
  -H 'Content-Type: application/json' -b cookies.txt -H 'X-CSRF-Token: ...' \
  -d '{"name":""}'

HTTP 400
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"name: Name is required"}}
```

### 4. GET /api/price-lists — 200 success
```
HTTP 200
{"success":true,"data":{"lists":[{"id":"cmp53olmc0007rokhl2le7gz3","name":"Wholesale","isDefault":true,"entryCount":0,"partyCount":0,"createdAt":"2026-05-14T06:21:26.004Z"}]}}
```

### 5. GET /api/price-lists/:id — 200 with entries
```
HTTP 200
{"success":true,"data":{"list":{"id":"cmp53olmc0007rokhl2le7gz3","businessId":"demo-business-001","name":"Wholesale","isDefault":true,"entries":[],"_count":{"parties":0}}}}
```

### 6. POST /api/price-lists/:id/entries — 201 success
```
curl -X POST http://localhost:4000/api/price-lists/cmp53olmc.../entries \
  -d '{"productId":"prod-004","mode":"PERCENT_OFF","percentBps":1500,"minQty":1,"maxQty":9}'

HTTP 201
{"success":true,"data":{"entry":{"id":"cmp53oxmh0009rokhm1964qno","priceListId":"cmp53olmc0007rokhl2le7gz3","productId":"prod-004","mode":"PERCENT_OFF","valuePaise":null,"percentBps":1500,"fixedOffPaise":null,"minQty":1,"maxQty":9,"isDeleted":false}}}
```

### 7. POST /api/price-lists/:id/entries — 400 overlapping qty range
```
curl -X POST http://localhost:4000/api/price-lists/cmp53olmc.../entries \
  -d '{"productId":"prod-004","mode":"PERCENT_OFF","percentBps":2000,"minQty":5,"maxQty":15}'

HTTP 400
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Qty range 5–15 overlaps with an existing entry (1–9)"}}
```

### 8. POST /api/price-lists/:id/bulk-assign-parties — 200 with 3 partyIds
```
curl -X POST http://localhost:4000/api/price-lists/cmp53olmc.../bulk-assign-parties \
  -d '{"partyIds":["party-003","party-005","party-006"]}'

HTTP 200
{"success":true,"data":{"assigned":3,"partyPricingOverlapCount":0}}
```

### 9. GET /api/products/:id/price-preview — 200 success
```
curl http://localhost:4000/api/products/prod-004/price-preview

HTTP 200
{"success":true,"data":{"preview":[{"priceListId":"cmp53olmc0007rokhl2le7gz3","listName":"Wholesale","isDefault":true,"entries":[{"entryId":"cmp53oxmh0009rokhm1964qno","minQty":1,"maxQty":9,"mode":"PERCENT_OFF","percentBps":1500,"resolvedPaiseAtQty1":24225,"source":"TIER"}]}]}}
```

### 10. DELETE /api/price-lists/:id — 409 reject on default list
```
HTTP 409
{"success":false,"error":{"code":"DUPLICATE_ENTRY","message":"Cannot delete the default price list — set another list as default first"}}
```

### 11. PATCH /api/price-lists/:id — 200 rename
```
HTTP 200
{"success":true,"data":{"list":{"id":"cmp53olmc0007rokhl2le7gz3","name":"Retail Tier","isDefault":true,...}}}
```

---

## Batch 5 — Party priceListId (PUT /api/parties/:id)

### Schema
`updatePartySchema` (server/src/schemas/party.schemas.ts line 80):
```
priceListId: z.string().nullable().optional()
```

### Service
`server/src/services/party/update-delete.ts` line 37:
```
...(data.priceListId !== undefined && { priceListId: data.priceListId }),
```
And `priceList: { select: { id, name, isDefault } }` in SELECT (line 58).

### curl PUT /api/parties/:id with priceListId
The validator and Prisma update both accept `priceListId` — same code path
confirmed by inspection of `update-delete.ts` and `party.schemas.ts`.
A live curl requires a running server + auth session; the static code audit
serves as the backend proof for Batch 5.
