-- DropIndex
DROP INDEX "tickets_organization_id_deleted_at_idx";

-- CreateIndex
CREATE INDEX "tickets_organization_id_deleted_at_updated_at_id_idx" ON "tickets"("organization_id", "deleted_at", "updated_at", "id");
