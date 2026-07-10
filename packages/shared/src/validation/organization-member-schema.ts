import { z } from "zod";

import { organizationMemberRoleSchema } from "./member-role-schema.js";

export const organizationMemberListItemResponseSchema = z
  .object({
    id: z.string().min(1, "メンバーIDは空文字でない文字列である必要があります"),
    userId: z
      .string()
      .min(1, "ユーザーIDは空文字でない文字列である必要があります"),
    name: z.string().nullable(),
    email: z.string().email("メールアドレスの形式が正しくありません"),
    role: organizationMemberRoleSchema,
    joinedAt: z.string().datetime("日時の形式が正しくありません"),
  })
  .transform((data) => ({
    ...data,
    joinedAt: new Date(data.joinedAt),
  }));

export type OrganizationMemberListItem = z.infer<
  typeof organizationMemberListItemResponseSchema
>;

export const organizationMembersListResponseSchema = z.object({
  members: z.array(organizationMemberListItemResponseSchema),
});
