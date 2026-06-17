import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError } from "@/lib/api-client";
import { mapApiErrorToFields, mapZodErrorToFields } from "@/lib/validation";

describe("mapZodErrorToFields", () => {
  it("Zod の issue をフィールドエラーに変換する", () => {
    const schema = z.object({
      email: z.string().email("メールアドレスの形式が正しくありません"),
      password: z.string().min(8, "パスワードは8文字以上で入力してください"),
    });
    const result = schema.safeParse({ email: "invalid", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = mapZodErrorToFields(result.error);
      expect(errors.email).toBe("メールアドレスの形式が正しくありません");
      expect(errors.password).toBe("パスワードは8文字以上で入力してください");
    }
  });

  it("同じフィールドに複数の issue がある場合は最後のメッセージを採用する", () => {
    const schema = z.object({
      email: z
        .string()
        .refine(() => false, { message: "最初のエラー" })
        .refine(() => false, { message: "最後のエラー" }),
    });
    const result = schema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = mapZodErrorToFields(result.error);
      expect(errors.email).toBe("最後のエラー");
    }
  });
});

describe("mapApiErrorToFields", () => {
  it("ApiError 以外のエラーでは空オブジェクトを返す", () => {
    expect(mapApiErrorToFields(new Error("test"))).toEqual({});
  });

  it("ApiError の details をフィールドエラーに変換する", () => {
    const error = new ApiError("入力内容を確認してください", 400, [
      { field: "email", message: "メールアドレスの形式が正しくありません" },
      { field: "password", message: "パスワードは8文字以上で入力してください" },
    ]);
    expect(mapApiErrorToFields(error)).toEqual({
      email: "メールアドレスの形式が正しくありません",
      password: "パスワードは8文字以上で入力してください",
    });
  });

  it("同じフィールドに複数の detail がある場合は最後のメッセージを採用する", () => {
    const error = new ApiError("入力内容を確認してください", 400, [
      { field: "email", message: "最初のエラー" },
      { field: "email", message: "最後のエラー" },
    ]);
    expect(mapApiErrorToFields(error)).toEqual({
      email: "最後のエラー",
    });
  });
});
