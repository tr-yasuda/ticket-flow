import { randomUUID } from "node:crypto";

export type OrganizationId = string;

export type Organization = Readonly<{
  id: OrganizationId;
  name: string;
  slug: string;
}>;

const MAX_NAME_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isNonEmptyString(value: string): boolean {
  return value.length > 0;
}

function isValidNameLength(name: string): boolean {
  return name.length <= MAX_NAME_LENGTH;
}

function isValidSlug(slug: string): boolean {
  return (
    isNonEmptyString(slug) &&
    slug.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}

function validateOrganization(
  id: OrganizationId,
  name: string,
  slug: string,
): Organization {
  if (!isNonEmptyString(name)) {
    throw new Error("name is required");
  }

  if (!isValidNameLength(name)) {
    throw new Error(
      `Organization name must be ${MAX_NAME_LENGTH} characters or fewer`,
    );
  }

  if (!isValidSlug(slug)) {
    throw new Error("slug format is invalid");
  }

  return {
    id,
    name,
    slug,
  };
}

function normalizeName(name: string): string {
  return name.trim();
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function createOrganization(name: string, slug: string): Organization {
  return validateOrganization(
    randomUUID(),
    normalizeName(name),
    normalizeSlug(slug),
  );
}

export function rehydrateOrganization(
  id: OrganizationId,
  name: string,
  slug: string,
): Organization {
  return validateOrganization(id, normalizeName(name), normalizeSlug(slug));
}
