-- CreateIndex
CREATE INDEX "organization_members_organization_id_role_idx" ON "organization_members"("organization_id", "role");
