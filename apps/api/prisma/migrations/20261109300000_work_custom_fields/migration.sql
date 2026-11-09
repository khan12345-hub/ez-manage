-- CreateTable
CREATE TABLE "work_custom_fields" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "work_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_field_values" (
    "taskId" INTEGER NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_field_values_pkey" PRIMARY KEY ("taskId","fieldId")
);

-- CreateIndex
CREATE INDEX "work_custom_fields_spaceId_idx" ON "work_custom_fields"("spaceId");

-- CreateIndex
CREATE INDEX "work_field_values_fieldId_idx" ON "work_field_values"("fieldId");

-- AddForeignKey
ALTER TABLE "work_custom_fields" ADD CONSTRAINT "work_custom_fields_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "work_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_field_values" ADD CONSTRAINT "work_field_values_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_field_values" ADD CONSTRAINT "work_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "work_custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

