import type { RefreshTokenRepository } from "../../domain/refresh-token-repository.js";
import type { RefreshToken } from "../../domain/refresh-token.js";
import { InMemoryRepository } from "./in-memory-repository.js";

type StoredRefreshToken = RefreshToken &
  Readonly<{
    createdAt: Date;
  }>;

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly repository = new InMemoryRepository<
    StoredRefreshToken,
    string
  >((refreshToken) => refreshToken.tokenHash);

  async findById(tokenHash: string): Promise<RefreshToken | null> {
    const record = await this.repository.findById(tokenHash);
    return record ? this.toRefreshToken(record) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.findById(tokenHash);
  }

  async findAll(): Promise<readonly RefreshToken[]> {
    const records = await this.repository.findAll();
    return records.map((record) => this.toRefreshToken(record));
  }

  async save(entity: RefreshToken): Promise<void> {
    const record: StoredRefreshToken = {
      ...entity,
      createdAt: new Date(),
    };
    return this.repository.save(record);
  }

  async delete(tokenHash: string): Promise<void> {
    return this.repository.delete(tokenHash);
  }

  private toRefreshToken(record: StoredRefreshToken): RefreshToken {
    return {
      tokenHash: record.tokenHash,
      userId: record.userId,
    };
  }
}
