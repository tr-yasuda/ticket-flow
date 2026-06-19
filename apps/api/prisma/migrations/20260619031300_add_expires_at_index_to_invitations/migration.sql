-- DropIndex
DROP INDEX "organization_invitations_email_idx";

-- CreateIndex
CREATE INDEX "organization_invitations_expires_at_idx" ON "organization_invitations"("expires_at");
