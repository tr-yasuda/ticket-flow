import {
  organizationsListResponseSchema,
  organizationWithoutRoleSchema,
  type CreateOrganizationInput,
  type Organization,
} from "@ticket-flow/shared";

import { apiClient } from "./api-client";
import { extractData } from "./api-response";

export type { Organization };

export async function getOrganizations(): Promise<{
  organizations: readonly Organization[];
}> {
  const body = await apiClient.get("organizations").json<unknown>();
  const data = extractData(
    body,
    organizationsListResponseSchema,
    "Invalid organizations response",
  );
  return data;
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<Omit<Organization, "role">> {
  const body = await apiClient
    .post("organizations", { json: input })
    .json<unknown>();
  return extractData(
    body,
    organizationWithoutRoleSchema,
    "Invalid organization response",
  );
}
