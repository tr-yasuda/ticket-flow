import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createUser } from "../../../../src/domain/user.js";
import { loadDatabaseConfig } from "../../../../src/infrastructure/database/config.js";
import { createPrismaClient } from "../../../../src/infrastructure/database/prisma-client.js";
import { PrismaUserRepository } from "../../../../src/infrastructure/database/prisma-user-repository.js";

const config = loadDatabaseConfig(process.env);
const prisma = createPrismaClient(config);
const repository = new PrismaUserRepository(prisma);

async function cleanUsers(): Promise<void> {
  await prisma.user.deleteMany();
}

describe("PrismaUserRepository 統合テスト", () => {
  beforeEach(cleanUsers);
  afterAll(async () => {
    await cleanUsers();
    await prisma.$disconnect();
  });

  it("findById で保存したユーザーを取得できる", async () => {
    const user = createUser("user@example.com", "password-hash");
    await repository.save(user);

    const found = await repository.findById(user.id);

    expect(found).toEqual(user);
  });

  it("findById で存在しない ID に対して null を返す", async () => {
    const found = await repository.findById("not-found");

    expect(found).toBeNull();
  });

  it("findAll で保存したすべてのユーザーを取得できる", async () => {
    const user1 = createUser("user1@example.com", "hash1");
    const user2 = createUser("user2@example.com", "hash2");
    await repository.save(user1);
    await repository.save(user2);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toContainEqual(user1);
    expect(all).toContainEqual(user2);
  });

  it("save で既存ユーザーを上書き更新できる", async () => {
    const user = createUser("user@example.com", "old-hash");
    await repository.save(user);

    const updated = { ...user, passwordHash: "new-hash" };
    await repository.save(updated);

    const found = await repository.findById(user.id);
    expect(found).toEqual(updated);
  });

  it("delete でユーザーを削除できる", async () => {
    const user = createUser("user@example.com", "hash");
    await repository.save(user);

    await repository.delete(user.id);

    const found = await repository.findById(user.id);
    expect(found).toBeNull();
  });

  it("delete で存在しない ID でも例外を投げない", async () => {
    await expect(repository.delete("missing-id")).resolves.toBeUndefined();
  });
});
