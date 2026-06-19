-- DropIndex
DROP INDEX "organization_invitations_email_idx";

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_organization_id_email_key" ON "organization_invitations"("organization_id", "email");
