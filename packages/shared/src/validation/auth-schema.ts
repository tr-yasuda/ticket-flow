import { z } from "zod";

function getByteLength(value: string): number {
  let byteLength = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) {
      byteLength += 1;
    } else if (code <= 0x7ff) {
      byteLength += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const low = value.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        byteLength += 4;
        i++;
      } else {
        byteLength += 3;
      }
    } else {
      byteLength += 3;
    }
  }
  return byteLength;
}

export const emailSchema = z
  .string({ message: "メールアドレスを入力してください" })
  .min(1, "メールアドレスを入力してください")
  .refine(
    (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+(?![\s\S])/.test(value),
    "メールアドレスの形式が正しくありません",
  );

export const passwordSchema = z
  .string({ message: "パスワードを入力してください" })
  .min(1, "パスワードを入力してください")
  .refine(
    (value) => getByteLength(value) >= 8,
    "パスワードは8バイト以上で入力してください",
  )
  .refine(
    (value) => getByteLength(value) <= 72,
    "パスワードは72バイト以内で入力してください",
  );

export const loginPasswordSchema = z
  .string({ message: "パスワードを入力してください" })
  .min(1, "パスワードを入力してください")
  .refine(
    (value) => getByteLength(value) <= 72,
    "パスワードは72バイト以内で入力してください",
  );

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
