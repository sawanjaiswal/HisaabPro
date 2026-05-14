-- Epic C PR1: Add SharedLink table for opaque public-link tokens (hash at rest)
-- Applied via: psql postgresql://sawanjaiswal@localhost:5432/hisaabpro_dev -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260514164500_epic_c_shared_link

-- CreateTable
CREATE TABLE "SharedLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedLink_tokenHash_key" ON "SharedLink"("tokenHash");

-- CreateIndex
CREATE INDEX "SharedLink_businessId_resourceType_idx" ON "SharedLink"("businessId", "resourceType");

-- CreateIndex
CREATE INDEX "SharedLink_resourceId_idx" ON "SharedLink"("resourceId");

-- AddForeignKey
ALTER TABLE "SharedLink" ADD CONSTRAINT "SharedLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedLink" ADD CONSTRAINT "SharedLink_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
