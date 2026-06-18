import type {
  OrganizationMemberRepository,
  OrganizationMemberWithOrganization,
} from "../../domain/organization-member-repository.js";
import type {
  OrganizationMember,
  OrganizationMemberId,
} from "../../domain/organization-member.js";
import { InMemoryOrganizationRepository } from "./in-memory-organization-repository.js";
import { InMemoryRepository } from "./in-memory-repository.js";

export class InMemoryOrganizationMemberRepository implements OrganizationMemberRepository {
  private readonly repository = new InMemoryRepository<
    OrganizationMember,
    OrganizationMemberId
  >((member) => member.id);

  constructor(
    private readonly organizationRepository?: InMemoryOrganizationRepository,
  ) {}

  async findById(id: OrganizationMemberId): Promise<OrganizationMember | null> {
    return this.repository.findById(id);
  }

  async findByOrganizationIdAndUserId(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null> {
    const members = await this.repository.findAll();
    return (
      members.find(
        (member) =>
          member.organizationId === organizationId && member.userId === userId,
      ) ?? null
    );
  }

  async findAll(): Promise<readonly OrganizationMember[]> {
    return this.repository.findAll();
  }

  async save(entity: OrganizationMember): Promise<void> {
    const existing = await this.findByOrganizationIdAndUserId(
      entity.organizationId,
      entity.userId,
    );
    if (existing !== null) {
      return this.repository.save({ ...entity, id: existing.id });
    }
    return this.repository.save(entity);
  }

  async delete(id: OrganizationMemberId): Promise<void> {
    return this.repository.delete(id);
  }

  async findByUserId(
    userId: string,
  ): Promise<readonly OrganizationMemberWithOrganization[]> {
    const members = await this.repository.findAll();
    const result: OrganizationMemberWithOrganization[] = [];
    for (const member of members.filter((m) => m.userId === userId)) {
      const organization = this.organizationRepository
        ? await this.organizationRepository.findById(member.organizationId)
        : undefined;
      result.push({
        membershipId: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        organizationName: organization?.name ?? "",
        organizationSlug: organization?.slug ?? "",
      });
    }
    return result;
  }

  withTransaction(_tx: unknown): OrganizationMemberRepository {
    return this;
  }
}
