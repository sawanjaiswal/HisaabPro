# Batch 1 Proof — Schema + Migration (#132 Price Lists)

**Date:** 2026-05-14
**Commit:** 64fd246

---

## Migration applied

Migration directory: `server/prisma/migrations/20260514112600_132_price_lists/`

Applied via psql+resolve (shadow-DB bypass — CONCURRENTLY index in existing migration 20260507130000_inventory_phase2_reorder blocks standard `migrate dev`).

```
psql "postgresql://sawanjaiswal@localhost:5432/hisaabpro_dev" -f migration.sql
→ CREATE TYPE, CREATE TABLE x2, CREATE INDEX x5, ALTER TABLE x3, ALTER TABLE x3 (FKs)

npx prisma migrate resolve --applied 20260514112600_132_price_lists
→ Migration 20260514112600_132_price_lists marked as applied.
```

---

## prisma generate

```
✔ Generated Prisma Client (v6.19.2) to ./node_modules/@prisma/client in 608ms
```

---

## tsc --noEmit

```
(no output — clean exit)
```

Zero TypeScript errors.

---

## Schema additions

### New enum
- `PriceListMode { ABSOLUTE | PERCENT_OFF | FIXED_OFF }`

### New models
- `PriceList` — 8 fields: id, businessId, name, isDefault (denorm mirror), isDeleted, deletedAt, createdAt, updatedAt
  - Relations: business (Restrict), entries, parties (PartyPriceList named), defaultForBusinesses (BusinessDefaultPriceList named)
  - Constraints: `@@unique([businessId, name])`, `@@index([businessId, isDeleted])`
- `PriceListEntry` — 12 fields: id, priceListId, productId, mode, valuePaise?, percentBps?, fixedOffPaise?, minQty (default 1), maxQty?, isDeleted, deletedAt, createdAt, updatedAt
  - Relations: priceList (Cascade), product (Restrict)
  - Constraints: `@@unique([priceListId, productId, minQty])`, `@@index([priceListId, productId, isDeleted])`, `@@index([productId])`

### Modified models
- `Party` — added `priceListId String?` + `priceList PriceList? @relation("PartyPriceList", ..., onDelete: SetNull)` + `@@index([businessId, priceListId])`
- `Business` — added `defaultPriceListId String?` + `defaultPriceList PriceList? @relation("BusinessDefaultPriceList", ..., onDelete: SetNull)`
- `Product` — added `priceListEntries PriceListEntry[]` inverse relation

---

## Acceptance checklist

- [x] Migration file created and applies cleanly
- [x] `npx prisma generate` succeeds
- [x] `tsc --noEmit` exits clean (zero errors)
- [x] All new models appear in `@prisma/client` (PriceList, PriceListEntry, PriceListMode)
- [x] All new columns on existing models (Party.priceListId, Business.defaultPriceListId) are nullable
- [x] No NOT-NULL tightening
