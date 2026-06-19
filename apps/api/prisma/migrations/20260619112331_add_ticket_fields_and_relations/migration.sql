-- RedefineTables
-- 既存チケットがないことを前提とする。NOT NULL 列を追加するため、既存行がある場合は
-- organization_id / created_by のバックフィルを行ってから適用すること。
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'in-progress', 'closed')),
    "priority" TEXT NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),
    "assignee_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("created_at", "id", "status", "title", "updated_at") SELECT "created_at", "id", "status", "title", "updated_at" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
CREATE INDEX "tickets_organization_id_status_idx" ON "tickets"("organization_id", "status");
CREATE INDEX "tickets_organization_id_created_at_idx" ON "tickets"("organization_id", "created_at");
CREATE INDEX "tickets_organization_id_assignee_id_idx" ON "tickets"("organization_id", "assignee_id");
CREATE INDEX "tickets_organization_id_created_by_idx" ON "tickets"("organization_id", "created_by");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
