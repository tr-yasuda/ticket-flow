import { resolve } from "node:path";

export function createTestDatabaseUrl(relativePath: string): string {
  return `file:${resolve(relativePath).replace(/\\/g, "/")}`;
}
