import type { UserRepository } from "../../domain/user-repository.js";
import type { User, UserId } from "../../domain/user.js";
import { InMemoryRepository } from "./in-memory-repository.js";

export class InMemoryUserRepository implements UserRepository {
  private readonly repository = new InMemoryRepository<User, UserId>(
    (user) => user.id,
  );

  async findById(id: UserId): Promise<User | null> {
    return this.repository.findById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = await this.repository.findAll();
    return users.find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findAll(): Promise<readonly User[]> {
    return this.repository.findAll();
  }

  async save(entity: User): Promise<void> {
    return this.repository.save(entity);
  }

  async delete(id: UserId): Promise<void> {
    return this.repository.delete(id);
  }
}
