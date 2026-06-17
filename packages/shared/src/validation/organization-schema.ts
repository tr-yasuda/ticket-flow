import { z } from "zod";

const MAX_NAME_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const organizationNameSchema = z
  .string({ error: "組織名を入力してください" })
  .trim()
  .min(1, { error: "組織名を入力してください" })
  .max(MAX_NAME_LENGTH, {
    error: `組織名は${MAX_NAME_LENGTH}文字以内で入力してください`,
  });

export const organizationSlugSchema = z
  .string({ error: "スラッグを入力してください" })
  .trim()
  .min(1, { error: "スラッグを入力してください" })
  .max(MAX_SLUG_LENGTH, {
    error: `スラッグは${MAX_SLUG_LENGTH}文字以内で入力してください`,
  })
  .refine((value) => SLUG_PATTERN.test(value), {
    error: "スラッグは英小文字・数字・ハイフンのみ使用できます",
  });

export const createOrganizationInputSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});

export type CreateOrganizationInput = z.infer<
  typeof createOrganizationInputSchema
>;
