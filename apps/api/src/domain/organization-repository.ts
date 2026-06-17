import type { Organization, OrganizationId } from "./organization.js";
import type { Repository } from "./repository.js";

export type OrganizationRepository = Repository<Organization, OrganizationId> &
  Readonly<{
    findBySlug(slug: string): Promise<Organization | null>;
    findByName(name: string): Promise<readonly Organization[]>;
  }>;
