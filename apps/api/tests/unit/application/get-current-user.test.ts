import { describe, expect, it } from "vitest";

import { getCurrentUser } from "../../../src/application/get-current-user";
import { createUser } from "../../../src/domain/user";
import { InMemoryUserRepository } from "../../../src/infrastructure/database/in-memory-user-repository";

describe("getCurrentUser", () => {
  it("ユーザーが存在する場合はユーザー情報を返す", async () => {
    const repository = new InMemoryUserRepository();
    const user = createUser("user@example.com", "hashed-password");
    await repository.save(user);

    const result = await getCurrentUser(
      { userId: user.id },
      { userRepository: repository },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.user.id).toBe(user.id);
    expect(result.data.user.email).toBe(user.email);
  });

  it("ユーザーが存在しない場合は user-not-found エラーを返す", async () => {
    const repository = new InMemoryUserRepository();

    const result = await getCurrentUser(
      { userId: "non-existent-id" },
      { userRepository: repository },
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.type).toBe("user-not-found");
  });
});
