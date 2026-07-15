-- CreateTable
CREATE TABLE "CourseAssistant" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseAssistant_courseId_assistantId_key" ON "CourseAssistant"("courseId", "assistantId");

-- AddForeignKey
ALTER TABLE "CourseAssistant" ADD CONSTRAINT "CourseAssistant_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssistant" ADD CONSTRAINT "CourseAssistant_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
