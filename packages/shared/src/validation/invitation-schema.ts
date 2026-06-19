import { z } from "zod";

import { emailSchema } from "./auth-schema.js";

export const invitableRoles = ["admin", "member", "viewer"] as const;

export const invitationRoleSchema = z.enum(invitableRoles);

export const createOrganizationInvitationInputSchema = z.object({
  email: emailSchema,
  role: invitationRoleSchema,
});

export type CreateOrganizationInvitationInput = z.infer<
  typeof createOrganizationInvitationInputSchema
>;
