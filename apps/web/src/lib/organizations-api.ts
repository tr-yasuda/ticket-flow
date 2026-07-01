import { apiClient } from "./api-client";
import { extractData, isRecord } from "./api-response";

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

export type Organization = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}>;

export type CreateOrganizationInput = Readonly<{
  name: string;
  slug: string;
}>;

function isOrganizationRole(value: unknown): value is OrganizationRole {
  return (
    typeof value === "string" &&
    ["owner", "admin", "member", "viewer"].includes(value)
  );
}

function isOrganization(value: unknown): value is Organization {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    isOrganizationRole(value.role)
  );
}

function isCreatedOrganization(
  value: unknown,
): value is Omit<Organization, "role"> {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string"
  );
}

function isOrganizationsData(
  data: unknown,
): data is { organizations: readonly Organization[] } {
  return isRecord(data) && Array.isArray(data.organizations);
}

export async function getOrganizations(): Promise<{
  organizations: readonly Organization[];
}> {
  const body = await apiClient.get("organizations").json<unknown>();
  const data = extractData(body, isOrganizationsData);
  if (!data.organizations.every(isOrganization)) {
    throw new Error("Invalid organizations response");
  }
  return data;
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<Omit<Organization, "role">> {
  const body = await apiClient
    .post("organizations", { json: input })
    .json<unknown>();
  return extractData(body, isCreatedOrganization);
}
