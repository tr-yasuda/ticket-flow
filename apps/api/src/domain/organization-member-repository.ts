import type {
  OrganizationMember,
  OrganizationMemberId,
} from "./organization-member.js";
import type { Repository } from "./repository.js";

export type OrganizationMemberRepository = Repository<
  OrganizationMember,
  OrganizationMemberId
> &
  Readonly<{
    findByOrganizationIdAndUserId(
      organizationId: string,
      userId: string,
    ): Promise<OrganizationMember | null>;
    withTransaction(tx: unknown): OrganizationMemberRepository;
  }>;
