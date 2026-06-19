-- DropIndex
DROP INDEX "organization_invitations_organization_id_email_key";

-- CreateIndex
CREATE INDEX "organization_invitations_expires_at_idx" ON "organization_invitations"("expires_at");
