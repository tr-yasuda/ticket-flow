import type { OrganizationMemberRepository } from "../domain/organization-member-repository.js";

export type OrganizationWithRole = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: string;
}>;

export type ListOrganizationsSuccess = Readonly<{
  organizations: readonly OrganizationWithRole[];
}>;

export type ListOrganizationsResult = {
  success: true;
  data: ListOrganizationsSuccess;
};

export type ListOrganizationsDependencies = Readonly<{
  organizationMemberRepository: OrganizationMemberRepository;
}>;

export async function listOrganizations(
  userId: string,
  deps: ListOrganizationsDependencies,
): Promise<ListOrganizationsResult> {
  const memberships =
    await deps.organizationMemberRepository.findByUserId(userId);

  const organizations = memberships.map((membership) => ({
    id: membership.organizationId,
    name: membership.organizationName,
    slug: membership.organizationSlug,
    role: membership.role,
  }));

  return {
    success: true,
    data: {
      organizations,
    },
  };
}
