import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { PrismaRefreshTokenRepository } from "../../../../src/infrastructure/database/prisma-refresh-token-repository";

function createPrismaClientStub(overrides: {
  findUnique?: () => Promise<unknown>;
  findMany?: () => Promise<unknown[]>;
  upsert?: () => Promise<unknown>;
  delete?: () => Promise<unknown>;
}) {
  return {
    refreshToken: {
      findUnique: overrides.findUnique ?? (async () => null),
      findMany: overrides.findMany ?? (async () => []),
      upsert: overrides.upsert ?? (async () => {}),
      delete: overrides.delete ?? (async () => {}),
    },
  } as unknown as PrismaClient;
}

type PrismaClient = ConstructorParameters<
  typeof PrismaRefreshTokenRepository
>[0];

describe("PrismaRefreshTokenRepository", () => {
  it("存在しないトークン削除時も例外を投げない", async () => {
    const prisma = createPrismaClientStub({
      delete: async () => {
        const error = new Prisma.PrismaClientKnownRequestError(
          "Record to delete does not exist",
          { code: "P2025", clientVersion: "test" },
        );
        throw error;
      },
    });
    const repository = new PrismaRefreshTokenRepository(prisma);

    await expect(
      repository.delete("missing-token-hash"),
    ).resolves.toBeUndefined();
  });

  it("P2025 以外の削除エラーはそのまま投げる", async () => {
    const prisma = createPrismaClientStub({
      delete: async () => {
        throw new Error("Unexpected error");
      },
    });
    const repository = new PrismaRefreshTokenRepository(prisma);

    await expect(repository.delete("token-hash")).rejects.toThrow(
      "Unexpected error",
    );
  });
});
