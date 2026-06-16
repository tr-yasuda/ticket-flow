import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { DuplicateEmailError } from "../../../../src/domain/repository-error";
import { PrismaUserRepository } from "../../../../src/infrastructure/database/prisma-user-repository";

function createPrismaClientStub(overrides: {
  findUnique?: () => Promise<unknown>;
  findMany?: () => Promise<unknown[]>;
  upsert?: () => Promise<unknown>;
  delete?: () => Promise<unknown>;
}) {
  return {
    user: {
      findUnique: overrides.findUnique ?? (async () => null),
      findMany: overrides.findMany ?? (async () => []),
      upsert: overrides.upsert ?? (async () => {}),
      delete: overrides.delete ?? (async () => {}),
    },
  } as unknown as PrismaClient;
}

type PrismaClient = ConstructorParameters<typeof PrismaUserRepository>[0];

describe("PrismaUserRepository", () => {
  it("重複したメールアドレス保存時に DuplicateEmailError を投げる", async () => {
    const prisma = createPrismaClientStub({
      upsert: async () => {
        const error = new Prisma.PrismaClientKnownRequestError(
          "Unique constraint failed",
          { code: "P2002", clientVersion: "test" },
        );
        throw error;
      },
    });
    const repository = new PrismaUserRepository(prisma);

    await expect(
      repository.save({
        id: "user-id",
        email: "user@example.com",
        passwordHash: "hash",
      }),
    ).rejects.toThrow(DuplicateEmailError);
  });

  it("存在しないユーザー削除時も例外を投げない", async () => {
    const prisma = createPrismaClientStub({
      delete: async () => {
        const error = new Prisma.PrismaClientKnownRequestError(
          "Record to delete does not exist",
          { code: "P2025", clientVersion: "test" },
        );
        throw error;
      },
    });
    const repository = new PrismaUserRepository(prisma);

    await expect(repository.delete("missing-id")).resolves.toBeUndefined();
  });

  it("P2025 以外の削除エラーはそのまま投げる", async () => {
    const prisma = createPrismaClientStub({
      delete: async () => {
        throw new Error("Unexpected error");
      },
    });
    const repository = new PrismaUserRepository(prisma);

    await expect(repository.delete("user-id")).rejects.toThrow(
      "Unexpected error",
    );
  });
});
