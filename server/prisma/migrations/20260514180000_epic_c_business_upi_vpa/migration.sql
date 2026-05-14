-- Epic C PR2: Add upiVpa (nullable) to Business for UPI QR on invoice (#129)
-- Applied via: psql ... -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260514180000_epic_c_business_upi_vpa

ALTER TABLE "Business" ADD COLUMN "upiVpa" VARCHAR(320);
