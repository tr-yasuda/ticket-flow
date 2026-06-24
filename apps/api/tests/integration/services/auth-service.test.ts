import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma.js";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "../../../src/services/auth-service.js";

async function cleanUsers(): Promise<void> {
  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.organizationInvitation.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

describe("auth-service 統合テスト", () => {
  beforeEach(cleanUsers);
  afterAll(async () => {
    await cleanUsers();
    await prisma.$disconnect();
  });

  it("registerUser でユーザーを登録できる", async () => {
    const result = await registerUser({
      email: "user@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.user.email).toBe("user@example.com");
    expect(result.data.accessToken).toBeTruthy();
    expect(result.data.refreshToken).toBeTruthy();
  });

  it("registerUser で重複メールアドレスを拒否する", async () => {
    await registerUser({ email: "user@example.com", password: "password123" });

    const result = await registerUser({
      email: "user@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("email-already-exists");
  });

  it("loginUser で登録済みユーザーがログインできる", async () => {
    await registerUser({ email: "user@example.com", password: "password123" });

    const result = await loginUser({
      email: "user@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.user.email).toBe("user@example.com");
    expect(result.data.accessToken).toBeTruthy();
    expect(result.data.refreshToken).toBeTruthy();
  });

  it("loginUser で誤ったパスワードを拒否する", async () => {
    await registerUser({ email: "user@example.com", password: "password123" });

    const result = await loginUser({
      email: "user@example.com",
      password: "wrong-password",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.type).toBe("authentication-failed");
  });

  it("refreshAccessToken でアクセストークンを再発行できる", async () => {
    const registered = await registerUser({
      email: "user@example.com",
      password: "password123",
    });
    expect(registered.success).toBe(true);
    if (!registered.success) {
      return;
    }

    const result = await refreshAccessToken({
      refreshToken: registered.data.refreshToken,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.accessToken).toBeTruthy();
  });

  it("logoutUser でリフレッシュトークンを無効化する", async () => {
    const registered = await registerUser({
      email: "user@example.com",
      password: "password123",
    });
    expect(registered.success).toBe(true);
    if (!registered.success) {
      return;
    }

    const logoutResult = await logoutUser({
      refreshToken: registered.data.refreshToken,
    });
    expect(logoutResult.success).toBe(true);

    const refreshResult = await refreshAccessToken({
      refreshToken: registered.data.refreshToken,
    });
    expect(refreshResult.success).toBe(false);
  });
});
