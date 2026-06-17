import { z } from "zod";

const textEncoder = new TextEncoder();

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}

export const emailSchema = z
  .string({ error: "メールアドレスを入力してください" })
  .min(1, { message: "メールアドレスを入力してください" })
  .pipe(
    z.string().email({ message: "メールアドレスの形式が正しくありません" }),
  );

export const passwordSchema = z
  .string({ error: "パスワードを入力してください" })
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
  .string({ error: "パスワードを入力してください" })
  .min(1, { error: "パスワードを入力してください" })
  .refine((value) => byteLength(value) <= 72, {
    error: "パスワードは72バイト以内で入力してください",
  });

export const loginInputSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
