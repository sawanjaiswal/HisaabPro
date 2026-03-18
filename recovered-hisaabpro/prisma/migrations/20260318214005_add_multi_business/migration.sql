-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionPreset" ADD VALUE 'PARTNER';
ALTER TYPE "PermissionPreset" ADD VALUE 'SALESMAN';
ALTER TYPE "PermissionPreset" ADD VALUE 'STOCK_MANAGER';
ALTER TYPE "PermissionPreset" ADD VALUE 'ACCOUNTANT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isShadowAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveBusinessId" TEXT;

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dataUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'dairy',
    "joinCode" TEXT NOT NULL,
    "joinCodeExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessJoinRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "role" "PermissionPreset" NOT NULL DEFAULT 'DELIVERY_ONLY',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_dataUserId_key" ON "Business"("dataUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Business_joinCode_key" ON "Business"("joinCode");

-- CreateIndex
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");

-- CreateIndex
CREATE INDEX "Business_joinCode_idx" ON "Business"("joinCode");

-- CreateIndex
CREATE INDEX "BusinessJoinRequest_userId_status_idx" ON "BusinessJoinRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "BusinessJoinRequest_businessId_status_idx" ON "BusinessJoinRequest"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessJoinRequest_businessId_userId_key" ON "BusinessJoinRequest"("businessId", "userId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_dataUserId_fkey" FOREIGN KEY ("dataUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessJoinRequest" ADD CONSTRAINT "BusinessJoinRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
