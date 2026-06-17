import { z } from "zod";

import { mapZodErrorToValidationDetails } from "../../src/validation/zod-error.js";

describe("mapZodErrorToValidationDetails", () => {
  it("ZodError から ApiValidationErrorDetail[] を生成する", () => {
    const schema = z.object({
      email: z.string().email("メールアドレスの形式が正しくありません"),
      password: z.string().min(8, "パスワードは8文字以上で入力してください"),
    });

    const result = schema.safeParse({ email: "invalid", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const details = mapZodErrorToValidationDetails(result.error);
      expect(details).toEqual(
        expect.arrayContaining([
          { field: "email", message: "メールアドレスの形式が正しくありません" },
          {
            field: "password",
            message: "パスワードは8文字以上で入力してください",
          },
        ]),
      );
    }
  });

  it("path[0] が文字列でない issue は無視する", () => {
    const schema = z.array(z.string().min(1, "必須です"));

    const result = schema.safeParse([""]);
    expect(result.success).toBe(false);
    if (!result.success) {
      const details = mapZodErrorToValidationDetails(result.error);
      expect(details).toEqual([]);
    }
  });
});
