-- DropIndex
DROP INDEX "Kit_code_key";

-- AlterTable
ALTER TABLE "Kit" ADD COLUMN     "courseId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Kit_code_courseId_key" ON "Kit"("code", "courseId");

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
