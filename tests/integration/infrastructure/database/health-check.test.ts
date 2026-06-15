import { describe, expect, it } from "vitest";
import { checkDatabaseHealth } from "../../../../src/infrastructure/database/health-check";

describe("データベースヘルスチェック", () => {
  it("クエリが成功する場合は healthy を返す", async () => {
    const fakePool = {
      query: async (_text: string): Promise<unknown> => ({
        rows: [{ "?column?": 1 }],
      }),
    };

    const health = await checkDatabaseHealth(fakePool);

    expect(health.status).toBe("healthy");
  });

  it("クエリが失敗する場合は unhealthy を返す", async () => {
    const fakePool = {
      query: async (_text: string): Promise<unknown> => {
        throw new Error("connection refused");
      },
    };

    const health = await checkDatabaseHealth(fakePool);

    expect(health.status).toBe("unhealthy");
    expect(health.error).toBeInstanceOf(Error);
  });
});
