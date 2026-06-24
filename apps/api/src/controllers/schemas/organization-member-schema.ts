import { z } from "zod";

export const updateOrganizationMemberRoleParamsSchema = z.object({
  userId: z
    .string()
    .uuid({ message: "ユーザーIDの形式が正しくありません" })
    .transform((value) => value.toLowerCase()),
});

export type UpdateOrganizationMemberRoleParams = z.infer<
  typeof updateOrganizationMemberRoleParamsSchema
>;
