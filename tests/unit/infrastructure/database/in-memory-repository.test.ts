import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "../../../../src/infrastructure/database/in-memory-repository";

type User = Readonly<{
  id: string;
  email: string;
}>;

describe("インメモリリポジトリ", () => {
  it("保存したエンティティを ID で取得できる", async () => {
    const repository = new InMemoryRepository<User, string>((user) => user.id);
    const user: User = { id: "user-1", email: "user@example.com" };

    await repository.save(user);
    const found = await repository.findById("user-1");

    expect(found).toEqual(user);
  });

  it("存在しない ID を指定した場合は null を返す", async () => {
    const repository = new InMemoryRepository<User, string>((user) => user.id);

    const found = await repository.findById("not-found");

    expect(found).toBeNull();
  });

  it("保存したエンティティをすべて取得できる", async () => {
    const repository = new InMemoryRepository<User, string>((user) => user.id);
    const user1: User = { id: "user-1", email: "user1@example.com" };
    const user2: User = { id: "user-2", email: "user2@example.com" };

    await repository.save(user1);
    await repository.save(user2);
    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toContainEqual(user1);
    expect(all).toContainEqual(user2);
  });

  it("ID を指定してエンティティを削除できる", async () => {
    const repository = new InMemoryRepository<User, string>((user) => user.id);
    const user: User = { id: "user-1", email: "user@example.com" };
    await repository.save(user);

    await repository.delete("user-1");
    const found = await repository.findById("user-1");

    expect(found).toBeNull();
  });

  it("同じ ID のエンティティを保存すると上書きされる", async () => {
    const repository = new InMemoryRepository<User, string>((user) => user.id);
    const original: User = { id: "user-1", email: "original@example.com" };
    const updated: User = { id: "user-1", email: "updated@example.com" };

    await repository.save(original);
    await repository.save(updated);
    const found = await repository.findById("user-1");

    expect(found).toEqual(updated);
  });
});
