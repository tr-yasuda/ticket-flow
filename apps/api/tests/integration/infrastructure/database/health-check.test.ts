import { describe, expect, it } from "vitest";

import { checkDatabaseHealth } from "../../../../src/infrastructure/database/health-check";
import type { DatabaseQueryable } from "../../../../src/infrastructure/database/health-check";

describe("データベースヘルスチェック", () => {
  it("クエリが成功する場合は healthy を返す", async () => {
    const fakeClient: DatabaseQueryable = {
      $queryRaw: async (): Promise<unknown> => [1],
    };

    const health = await checkDatabaseHealth(fakeClient);

    expect(health.status).toBe("healthy");
  });

  it("クエリが失敗する場合は unhealthy を返す", async () => {
    const fakeClient: DatabaseQueryable = {
      $queryRaw: async (): Promise<unknown> => {
        throw new Error("connection refused");
      },
    };

    const health = await checkDatabaseHealth(fakeClient);

    expect(health.status).toBe("unhealthy");
    expect(health.error).toBeInstanceOf(Error);
  });
});
