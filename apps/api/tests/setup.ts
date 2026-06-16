import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function toPrismaSqliteUrl(filePath: string): string {
  // Prisma の SQLite ダイアレクトは `file:` プロトコル接頭辞の後に絶対パスを期待する。
  // pathToFileURL は `file:///` を付けるため、Prisma が解釈できる `file:` 形式に正規化する。
  return pathToFileURL(filePath).href.replace(/^file:\/+/, "file:");
}

const defaultTestDatabaseUrl = toPrismaSqliteUrl(
  resolve(process.cwd(), "prisma/test.db"),
);

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
  process.env.DATABASE_URL = defaultTestDatabaseUrl;
}

console.log("[DEBUG] DATABASE_URL:", process.env.DATABASE_URL);
console.log("[DEBUG] cwd:", process.cwd());
