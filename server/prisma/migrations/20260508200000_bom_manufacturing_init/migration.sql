-- Phase 4 — BOM / Manufacturing (#115) — additive migration.
-- Creates 4 new tables. No NOT NULL added to existing columns. No columns dropped.
-- Resolved via: npx prisma migrate resolve --applied 20260508200000_bom_manufacturing_init

-- ─── Bom ─────────────────────────────────────────────────────────────────────

CREATE TABLE "Bom" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "name"       VARCHAR(100) NOT NULL,
  "version"    INTEGER NOT NULL DEFAULT 1,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "isDefault"  BOOLEAN NOT NULL DEFAULT false,
  "notes"      TEXT,
  "isDeleted"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  "createdBy"  TEXT NOT NULL,
  "updatedBy"  TEXT,

  CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

-- ─── BomComponent ─────────────────────────────────────────────────────────────

CREATE TABLE "BomComponent" (
  "id"                 TEXT NOT NULL,
  "bomId"              TEXT NOT NULL,
  "componentProductId" TEXT NOT NULL,
  "quantity"           DOUBLE PRECISION NOT NULL,
  "unitId"             TEXT,
  "notes"              TEXT,

  CONSTRAINT "BomComponent_pkey" PRIMARY KEY ("id")
);

-- ─── ProductionRun ────────────────────────────────────────────────────────────

CREATE TABLE "ProductionRun" (
  "id"                TEXT NOT NULL,
  "businessId"        TEXT NOT NULL,
  "bomId"             TEXT NOT NULL,
  "finishedProductId" TEXT NOT NULL,
  "quantityProduced"  DOUBLE PRECISION NOT NULL,
  "runDate"           TIMESTAMP(3) NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'COMPLETED',
  "notes"             TEXT,
  "warnings"          JSONB,
  "isDeleted"         BOOLEAN NOT NULL DEFAULT false,
  "createdBy"         TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionRun_pkey" PRIMARY KEY ("id")
);

-- ─── ProductionRunComponent ───────────────────────────────────────────────────

CREATE TABLE "ProductionRunComponent" (
  "id"                 TEXT NOT NULL,
  "productionRunId"    TEXT NOT NULL,
  "componentProductId" TEXT NOT NULL,
  "quantityConsumed"   DOUBLE PRECISION NOT NULL,
  "costSnapshotPaise"  BIGINT NOT NULL DEFAULT 0,

  CONSTRAINT "ProductionRunComponent_pkey" PRIMARY KEY ("id")
);

-- ─── Foreign keys — Bom ───────────────────────────────────────────────────────

ALTER TABLE "Bom" ADD CONSTRAINT "Bom_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bom" ADD CONSTRAINT "Bom_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bom" ADD CONSTRAINT "Bom_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Foreign keys — BomComponent ─────────────────────────────────────────────

ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_bomId_fkey"
  FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_componentProductId_fkey"
  FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Foreign keys — ProductionRun ────────────────────────────────────────────

ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_bomId_fkey"
  FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_finishedProductId_fkey"
  FOREIGN KEY ("finishedProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Foreign keys — ProductionRunComponent ───────────────────────────────────

ALTER TABLE "ProductionRunComponent" ADD CONSTRAINT "ProductionRunComponent_productionRunId_fkey"
  FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionRunComponent" ADD CONSTRAINT "ProductionRunComponent_componentProductId_fkey"
  FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Unique constraints ───────────────────────────────────────────────────────

CREATE UNIQUE INDEX "Bom_businessId_productId_version_key" ON "Bom"("businessId", "productId", "version");
CREATE UNIQUE INDEX "BomComponent_bomId_componentProductId_key" ON "BomComponent"("bomId", "componentProductId");

-- ─── Indexes — Bom ───────────────────────────────────────────────────────────

CREATE INDEX "Bom_businessId_productId_idx" ON "Bom"("businessId", "productId");
CREATE INDEX "Bom_businessId_isDeleted_idx" ON "Bom"("businessId", "isDeleted");

-- ─── Indexes — BomComponent ───────────────────────────────────────────────────

CREATE INDEX "BomComponent_bomId_idx" ON "BomComponent"("bomId");

-- ─── Indexes — ProductionRun ──────────────────────────────────────────────────

CREATE INDEX "ProductionRun_businessId_runDate_idx" ON "ProductionRun"("businessId", "runDate");
CREATE INDEX "ProductionRun_businessId_status_idx" ON "ProductionRun"("businessId", "status");
CREATE INDEX "ProductionRun_businessId_isDeleted_idx" ON "ProductionRun"("businessId", "isDeleted");

-- ─── Indexes — ProductionRunComponent ────────────────────────────────────────

CREATE INDEX "ProductionRunComponent_productionRunId_idx" ON "ProductionRunComponent"("productionRunId");
