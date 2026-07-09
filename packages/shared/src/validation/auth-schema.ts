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
  .min(1, "名前を入力してください")
  .max(100, "名前は100文字以内で入力してください")
  .optional();

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: userNameSchema,
});

export const currentUserSchema = z.object({
  id: z.string().min(1, "ユーザーIDは空文字でない文字列である必要があります"),
  email: z.string().email("メールアドレスの形式が正しくありません"),
  name: z.string().nullable(),
});

export const authTokensSchema = z.object({
  accessToken: z.string().min(1, "アクセストークンが必要です"),
  refreshToken: z.string().min(1, "リフレッシュトークンが必要です"),
});

export const refreshTokenResponseSchema = z.object({
  accessToken: z.string().min(1, "アクセストークンが必要です"),
  refreshToken: z.string().min(1, "リフレッシュトークンが必要です").optional(),
});

export const authResponseSchema = z.object({
  user: currentUserSchema,
  ...authTokensSchema.shape,
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
