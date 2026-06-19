import { organizationNameSchema } from "@ticket-flow/shared";
import { z } from "zod";

export const organizationOnboardingSchema = z.object({
  name: organizationNameSchema,
});

export type OrganizationOnboardingInput = z.infer<
  typeof organizationOnboardingSchema
>;
