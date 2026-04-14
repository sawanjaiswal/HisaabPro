-- Add unique constraint on User.email (nulls allowed, only non-null values must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Add context column to OtpCode for storing registration pending data
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "context" TEXT;
