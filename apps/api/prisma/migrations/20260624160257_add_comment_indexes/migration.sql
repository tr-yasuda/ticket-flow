-- DropIndex
DROP INDEX "comments_organization_id_ticket_id_idx";

-- CreateIndex
CREATE INDEX "comments_organization_id_ticket_id_created_at_idx" ON "comments"("organization_id", "ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_ticket_id_idx" ON "comments"("ticket_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");
