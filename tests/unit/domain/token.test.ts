import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../../src/domain/token";

const testConfig = {
  secret: "test-secret-at-least-32-bytes-long!",
  accessExpiresIn: "1h",
  refreshExpiresIn: "7d",
};

const expiredConfig = {
  ...testConfig,
  accessExpiresIn: "-1s",
  refreshExpiresIn: "-1s",
};

const invalidConfig = {
  ...testConfig,
  secret: "different-secret-at-least-32-bytes!",
};

describe("アクセストークン", () => {
  it("有効なアクセストークンは検証に成功する", async () => {
    const payload = { userId: "user-123" };

    const token = await generateAccessToken(payload, testConfig);
    const verified = await verifyAccessToken(token, testConfig);

    expect(verified.userId).toBe("user-123");
  });

  it("期限切れのアクセストークンは検証に失敗する", async () => {
    const payload = { userId: "user-123" };
    const token = await generateAccessToken(payload, expiredConfig);

    await expect(verifyAccessToken(token, testConfig)).rejects.toThrow(
      "Token has expired",
    );
  });

  it("署名が異なるアクセストークンは検証に失敗する", async () => {
    const payload = { userId: "user-123" };
    const token = await generateAccessToken(payload, testConfig);

    await expect(verifyAccessToken(token, invalidConfig)).rejects.toThrow(
      "Invalid token",
    );
  });

  it("userId が含まれていないトークンは検証に失敗する", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(testConfig.accessExpiresIn)
      .sign(new TextEncoder().encode(testConfig.secret));

    await expect(verifyAccessToken(token, testConfig)).rejects.toThrow(
      "Invalid token",
    );
  });

  it("アクセストークンをリフレッシュトークンとして検証できない", async () => {
    const payload = { userId: "user-123" };
    const token = await generateAccessToken(payload, testConfig);

    await expect(verifyRefreshToken(token, testConfig)).rejects.toThrow(
      "Invalid token",
    );
  });
});

describe("リフレッシュトークン", () => {
  it("有効なリフレッシュトークンは検証に成功する", async () => {
    const payload = { userId: "user-123" };

    const token = await generateRefreshToken(payload, testConfig);
    const verified = await verifyRefreshToken(token, testConfig);

    expect(verified.userId).toBe("user-123");
  });

  it("期限切れのリフレッシュトークンは検証に失敗する", async () => {
    const payload = { userId: "user-123" };
    const token = await generateRefreshToken(payload, expiredConfig);

    await expect(verifyRefreshToken(token, testConfig)).rejects.toThrow(
      "Token has expired",
    );
  });

  it("署名が異なるリフレッシュトークンは検証に失敗する", async () => {
    const payload = { userId: "user-123" };
    const token = await generateRefreshToken(payload, testConfig);

    await expect(verifyRefreshToken(token, invalidConfig)).rejects.toThrow(
      "Invalid token",
    );
  });

  it("リフレッシュトークンをアクセストークンとして検証できない", async () => {
    const payload = { userId: "user-123" };
    const token = await generateRefreshToken(payload, testConfig);

    await expect(verifyAccessToken(token, testConfig)).rejects.toThrow(
      "Invalid token",
    );
  });
});
