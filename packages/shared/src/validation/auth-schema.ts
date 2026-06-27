import { z } from "zod";

const textEncoder = new TextEncoder();

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}

export const emailSchema = z
  .string({ message: "メールアドレスを入力してください" })
  .min(1, { message: "メールアドレスを入力してください" })
  .pipe(
    z.string().email({ message: "メールアドレスの形式が正しくありません" }),
  );

export const passwordSchema = z
  .string({ message: "パスワードを入力してください" })
  .superRefine((value, ctx) => {
    if (value === "") {
      ctx.addIssue({
        code: "custom",
        message: "パスワードを入力してください",
      });
      return;
    }

    const length = byteLength(value);
    if (length < 8) {
      ctx.addIssue({
        code: "custom",
        message: "パスワードは8バイト以上で入力してください",
      });
    } else if (length > 72) {
      ctx.addIssue({
        code: "custom",
        message: "パスワードは72バイト以内で入力してください",
      });
    }
  });

export const loginPasswordSchema = z
  .string({ message: "パスワードを入力してください" })
  .min(1, { message: "パスワードを入力してください" })
  .refine((value) => byteLength(value) <= 72, {
    message: "パスワードは72バイト以内で入力してください",
  });

export const loginInputSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const userNameSchema = z
  .string()
  .max(100, "名前は100文字以内で入力してください")
  .optional();

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: userNameSchema,
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
