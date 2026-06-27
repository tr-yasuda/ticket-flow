-- AlterTable
ALTER TABLE "comments" ADD COLUMN "deleted_at" DATETIME;

-- DropIndex
DROP INDEX "comments_organization_id_ticket_id_created_at_idx";

-- CreateIndex
CREATE INDEX "comments_organization_id_ticket_id_deleted_at_created_at_idx" ON "comments"("organization_id", "ticket_id", "deleted_at", "created_at");
