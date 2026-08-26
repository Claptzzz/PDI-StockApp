-- AlterTable
ALTER TABLE "Kit" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "KitItem" ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "KitAcceptance" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termsVersion" TEXT NOT NULL,

    CONSTRAINT "KitAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KitAcceptance_kitId_studentId_key" ON "KitAcceptance"("kitId", "studentId");

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAcceptance" ADD CONSTRAINT "KitAcceptance_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAcceptance" ADD CONSTRAINT "KitAcceptance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

