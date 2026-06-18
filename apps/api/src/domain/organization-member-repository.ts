import type {
  OrganizationMember,
  OrganizationMemberId,
  OrganizationMemberRole,
} from "./organization-member.js";
import type { Repository } from "./repository.js";

export type OrganizationMembership = Readonly<{
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationMemberRole;
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
    findByUserId(userId: string): Promise<readonly OrganizationMembership[]>;
    withTransaction(tx: unknown): OrganizationMemberRepository;
  }>;
