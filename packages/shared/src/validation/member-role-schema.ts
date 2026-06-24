import { z } from "zod";

export const organizationMemberRoles = [
  "owner",
  "admin",
  "member",
  "viewer",
] as const;

export const organizationMemberRoleSchema = z.enum(organizationMemberRoles, {
  message: "ロールの値が正しくありません",
});

export const updateOrganizationMemberRoleInputSchema = z.object({
  role: organizationMemberRoleSchema,
});

export type UpdateOrganizationMemberRoleInput = z.infer<
  typeof updateOrganizationMemberRoleInputSchema
>;
