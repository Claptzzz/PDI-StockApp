-- CreateTable
CREATE TABLE "DiscrepancyResolution" (
    "id" TEXT NOT NULL,
    "kitItemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "resolvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscrepancyResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscrepancyResolution_kitItemId_createdAt_idx" ON "DiscrepancyResolution"("kitItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscrepancyResolution" ADD CONSTRAINT "DiscrepancyResolution_kitItemId_fkey" FOREIGN KEY ("kitItemId") REFERENCES "KitItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscrepancyResolution" ADD CONSTRAINT "DiscrepancyResolution_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

