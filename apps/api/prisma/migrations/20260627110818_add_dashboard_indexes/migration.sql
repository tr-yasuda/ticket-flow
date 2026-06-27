-- CreateIndex
CREATE INDEX "tickets_organization_id_priority_idx" ON "tickets"("organization_id", "priority");

-- CreateIndex
CREATE INDEX "tickets_organization_id_assignee_id_deleted_at_status_idx" ON "tickets"("organization_id", "assignee_id", "deleted_at", "status");
