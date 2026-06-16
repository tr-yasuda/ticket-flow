import type { Repository } from "../../domain/repository.js";

export class InMemoryRepository<TEntity, TId> implements Repository<
  TEntity,
  TId
> {
  private readonly entities = new Map<TId, TEntity>();

  constructor(private readonly getId: (entity: TEntity) => TId) {}

  async findById(id: TId): Promise<TEntity | null> {
    const entity = this.entities.get(id);
    return entity ? ({ ...entity } as TEntity) : null;
  }

  async findAll(): Promise<readonly TEntity[]> {
    return Array.from(this.entities.values()).map(
      (entity) => ({ ...entity }) as TEntity,
    );
  }

  async save(entity: TEntity): Promise<void> {
    this.entities.set(this.getId(entity), { ...entity } as TEntity);
  }

  async delete(id: TId): Promise<void> {
    this.entities.delete(id);
  }
}
