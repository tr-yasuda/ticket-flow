import { z } from "zod";

export const organizationMemberUserIdParamSchema = z.object({
  userId: z
    .string()
    .uuid({ message: "ユーザーIDの形式が正しくありません" })
    .transform((value) => value.toLowerCase()),
});

export const updateOrganizationMemberRoleParamsSchema =
  organizationMemberUserIdParamSchema;

export type UpdateOrganizationMemberRoleParams = z.infer<
  typeof updateOrganizationMemberRoleParamsSchema
>;

export const deleteOrganizationMemberParamsSchema =
  organizationMemberUserIdParamSchema;

export type DeleteOrganizationMemberParams = z.infer<
  typeof deleteOrganizationMemberParamsSchema
>;
