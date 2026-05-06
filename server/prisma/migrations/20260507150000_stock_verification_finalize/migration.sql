-- Add finalizedAt and finalizedBy to StockVerification for the finalize step
ALTER TABLE "StockVerification" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "StockVerification" ADD COLUMN "finalizedBy" TEXT;
