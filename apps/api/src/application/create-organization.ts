import type { OrganizationMemberRepository } from "../domain/organization-member-repository.js";
import { createOrganizationMember } from "../domain/organization-member.js";
import type { OrganizationRepository } from "../domain/organization-repository.js";
import { createOrganization as createOrganizationEntity } from "../domain/organization.js";
import type { Organization } from "../domain/organization.js";
import { DuplicateSlugError } from "../domain/repository-error.js";
import type { TransactionRunner } from "./transaction-runner.js";

export type CreateOrganizationInput = Readonly<{
  name: string;
  slug: string;
  ownerUserId: string;
}>;

export type CreateOrganizationSuccess = Readonly<{
  organization: Organization;
}>;

export type CreateOrganizationError = Readonly<{
  type: "slug-already-exists";
  message: string;
}>;

export type CreateOrganizationResult =
  | { success: true; data: CreateOrganizationSuccess }
  | { success: false; error: CreateOrganizationError };

export type CreateOrganizationDependencies = Readonly<{
  organizationRepository: OrganizationRepository;
  organizationMemberRepository: OrganizationMemberRepository;
  transactionRunner: TransactionRunner;
}>;

export async function createOrganization(
  input: CreateOrganizationInput,
  deps: CreateOrganizationDependencies,
): Promise<CreateOrganizationResult> {
  const organization = createOrganizationEntity(input.name, input.slug);
  const ownerMember = createOrganizationMember(
    organization.id,
    input.ownerUserId,
    "owner",
  );

  try {
    await deps.transactionRunner.run(async (tx) => {
      const orgRepo = deps.organizationRepository.withTransaction(tx);
      const memberRepo = deps.organizationMemberRepository.withTransaction(tx);
      await orgRepo.save(organization);
      await memberRepo.save(ownerMember);
    });
  } catch (error) {
    if (error instanceof DuplicateSlugError) {
      return {
        success: false,
        error: {
          type: "slug-already-exists",
          message: "Slug already exists",
        },
      };
    }
    throw error;
  }

  return {
    success: true,
    data: {
      organization,
    },
  };
}
