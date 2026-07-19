-- CreateTable
CREATE TABLE "unscoped_access_log" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "subjectBusinessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unscoped_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unscoped_access_log_createdAt_idx" ON "unscoped_access_log"("createdAt");

-- CreateIndex
CREATE INDEX "unscoped_access_log_reason_idx" ON "unscoped_access_log"("reason");
