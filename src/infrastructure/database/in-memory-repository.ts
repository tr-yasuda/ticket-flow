import type { Repository } from "../../domain/repository";

export class InMemoryRepository<TEntity, TId>
  implements Repository<TEntity, TId>
{
  private readonly entities = new Map<TId, TEntity>();

  constructor(private readonly getId: (entity: TEntity) => TId) {}

  async findById(id: TId): Promise<TEntity | null> {
    return this.entities.get(id) ?? null;
  }

  async findAll(): Promise<readonly TEntity[]> {
    return Array.from(this.entities.values());
  }

  async save(entity: TEntity): Promise<void> {
    this.entities.set(this.getId(entity), entity);
  }

  async delete(id: TId): Promise<void> {
    this.entities.delete(id);
  }
}
