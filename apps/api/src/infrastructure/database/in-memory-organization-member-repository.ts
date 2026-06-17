import type { OrganizationMemberRepository } from "../../domain/organization-member-repository.js";
import type {
  OrganizationMember,
  OrganizationMemberId,
} from "../../domain/organization-member.js";
import { InMemoryRepository } from "./in-memory-repository.js";

export class InMemoryOrganizationMemberRepository implements OrganizationMemberRepository {
  private readonly repository = new InMemoryRepository<
    OrganizationMember,
    OrganizationMemberId
  >((member) => member.id);

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

  withTransaction(_tx: unknown): OrganizationMemberRepository {
    return this;
  }
}
