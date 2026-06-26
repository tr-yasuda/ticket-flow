-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "deleted_at" DATETIME;

-- CreateIndex
CREATE INDEX "tickets_organization_id_deleted_at_idx" ON "tickets"("organization_id", "deleted_at");
