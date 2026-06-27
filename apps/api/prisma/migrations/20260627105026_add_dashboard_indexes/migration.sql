-- CreateIndex
CREATE INDEX "tickets_organization_id_priority_idx" ON "tickets"("organization_id", "priority");

-- CreateIndex
CREATE INDEX "tickets_organization_id_assignee_id_status_deleted_at_idx" ON "tickets"("organization_id", "assignee_id", "status", "deleted_at");
