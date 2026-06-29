import { rmSync } from "node:fs";
import path from "node:path";

const E2E_DB_PATH = path.resolve(
  import.meta.dirname,
  "../apps/api/prisma/e2e-test.db",
);

export default async function globalSetup(): Promise<void> {
  // E2E 用 DB をクリーンな状態に戻す。
  // Windows では他プロセスがファイルをロックしている場合、削除に失敗する可能性があるため、
  // その場合は警告を出力して続行する。
  // migrate + seed は API の dev スクリプトが起動時に行う。
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    try {
      rmSync(`${E2E_DB_PATH}${suffix}`, { force: true });
    } catch (error) {
      console.warn(
        `Failed to remove ${E2E_DB_PATH}${suffix}, continuing anyway:`,
        error,
      );
    }
  }
}
