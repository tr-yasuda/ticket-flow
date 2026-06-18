-- DropIndex
DROP INDEX "organization_members_organization_id_user_id_key";

-- CreateTable
CREATE TABLE "organization_members_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('owner', 'admin', 'member', 'viewer')),
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "organization_members_new_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "organization_members_new_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CopyData
INSERT INTO "organization_members_new" ("id", "organization_id", "user_id", "role", "created_at", "updated_at")
SELECT "id", "organization_id", "user_id", "role", "created_at", "updated_at" FROM "organization_members";

-- DropTable
DROP TABLE "organization_members";

-- RenameTable
ALTER TABLE "organization_members_new" RENAME TO "organization_members";

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");
