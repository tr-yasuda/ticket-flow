import { rmSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const dbFiles = [
  "apps/api/prisma/e2e-test.db",
  "apps/api/prisma/e2e-test.db-wal",
  "apps/api/prisma/e2e-test.db-shm",
];

for (const file of dbFiles) {
  rmSync(resolve(repoRoot, file), { force: true });
}

console.log("E2E database cleaned");
