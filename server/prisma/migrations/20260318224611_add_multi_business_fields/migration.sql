-- AlterTable
ALTER TABLE "StaffInvite" ALTER COLUMN "roleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActiveBusinessId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastActiveBusinessId_fkey" FOREIGN KEY ("lastActiveBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
