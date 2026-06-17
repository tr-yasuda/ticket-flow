import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { GetCurrentUserDependencies } from "../../../../src/application/get-current-user";
import { createMeHandler } from "../../../../src/presentation/handlers/me-handler";

function createTestHandler(overrides?: Partial<GetCurrentUserDependencies>) {
  const deps: GetCurrentUserDependencies = {
    userRepository: {
      findById: async () => null,
      findByEmail: async () => null,
      findAll: async () => [],
      save: async () => {},
      delete: async () => {},
    },
    ...overrides,
  };

  const app = new Hono();
  app.get(
    "/api/me",
    async (c, next) => {
      c.set("userId", "user-id");
      await next();
    },
    createMeHandler(deps),
  );
  return app;
}

describe("current user ハンドラ", () => {
  it("認証済みユーザー情報を返す", async () => {
    const app = createTestHandler({
      userRepository: {
        findById: async (id) =>
          id === "user-id"
            ? { id: "user-id", email: "user@example.com", passwordHash: "hash" }
            : null,
        findByEmail: async () => null,
        findAll: async () => [],
        save: async () => {},
        delete: async () => {},
      },
    });

    const response = await app.request("/api/me");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toEqual({
      id: "user-id",
      email: "user@example.com",
    });
  });

  it("ユーザーが存在しない場合は 401 を返す", async () => {
    const app = createTestHandler();

    const response = await app.request("/api/me");

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("context に userId がない場合は 401 を返す", async () => {
    const app = new Hono();
    app.get(
      "/api/me",
      createMeHandler({
        userRepository: {
          findById: async () => null,
          findByEmail: async () => null,
          findAll: async () => [],
          save: async () => {},
          delete: async () => {},
        },
      }),
    );

    const response = await app.request("/api/me");

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AUTH_UNAUTHORIZED");
  });
});
