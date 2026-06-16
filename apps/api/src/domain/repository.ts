export type Repository<TEntity, TId> = Readonly<{
  findById(id: TId): Promise<TEntity | null>;
  findAll(): Promise<readonly TEntity[]>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}>;
