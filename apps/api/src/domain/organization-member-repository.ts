import type {
  OrganizationMember,
  OrganizationMemberId,
  OrganizationMemberRole,
} from "./organization-member.js";
import type { Repository } from "./repository.js";

export type OrganizationMemberWithOrganization = Readonly<{
  membershipId: string;
  organizationId: string;
  userId: string;
  role: OrganizationMemberRole;
  organizationName: string;
  organizationSlug: string;
}>;

export type OrganizationMemberRepository = Repository<
  OrganizationMember,
  OrganizationMemberId
> &
  Readonly<{
    findByOrganizationIdAndUserId(
      organizationId: string,
      userId: string,
    ): Promise<OrganizationMember | null>;
    findByUserId(
      userId: string,
    ): Promise<readonly OrganizationMemberWithOrganization[]>;
    withTransaction(tx: unknown): OrganizationMemberRepository;
  }>;
