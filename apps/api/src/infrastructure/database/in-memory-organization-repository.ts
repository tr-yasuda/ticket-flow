import type { OrganizationRepository } from "../../domain/organization-repository.js";
import type {
  Organization,
  OrganizationId,
} from "../../domain/organization.js";
import { DuplicateSlugError } from "../../domain/repository-error.js";
import { InMemoryRepository } from "./in-memory-repository.js";

export class InMemoryOrganizationRepository implements OrganizationRepository {
  private readonly repository = new InMemoryRepository<
    Organization,
    OrganizationId
  >((organization) => organization.id);

  async findById(id: OrganizationId): Promise<Organization | null> {
    return this.repository.findById(id);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    const organizations = await this.repository.findAll();
    return (
      organizations.find(
        (organization) => organization.slug === normalizedSlug,
      ) ?? null
    );
  }

  async findByName(name: string): Promise<readonly Organization[]> {
    const query = name.trim().toLowerCase();
    const organizations = await this.repository.findAll();
    return organizations.filter((organization) =>
      organization.name.toLowerCase().includes(query),
    );
  }

  async findAll(): Promise<readonly Organization[]> {
    return this.repository.findAll();
  }

  async save(entity: Organization): Promise<void> {
    const existing = await this.findBySlug(entity.slug);
    if (existing !== null && existing.id !== entity.id) {
      throw new DuplicateSlugError();
    }
    return this.repository.save(entity);
  }

  async delete(id: OrganizationId): Promise<void> {
    return this.repository.delete(id);
  }

  withTransaction(_tx: unknown): OrganizationRepository {
    return this;
  }
}
