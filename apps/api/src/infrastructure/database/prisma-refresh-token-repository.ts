import { PrismaClient, Prisma } from "@prisma/client";

import type { RefreshTokenRepository } from "../../domain/refresh-token-repository.js";
import type { RefreshToken } from "../../domain/refresh-token.js";

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tokenHash: string): Promise<RefreshToken | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return record ? this.toRefreshToken(record) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.findById(tokenHash);
  }

  async findAll(): Promise<readonly RefreshToken[]> {
    const records = await this.prisma.refreshToken.findMany();
    return records.map((record) => this.toRefreshToken(record));
  }

  async save(entity: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { tokenHash: entity.tokenHash },
      create: {
        tokenHash: entity.tokenHash,
        userId: entity.userId,
      },
      update: {
        userId: entity.userId,
      },
    });
  }

  async delete(tokenHash: string): Promise<void> {
    try {
      await this.prisma.refreshToken.delete({ where: { tokenHash } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return;
      }
      throw error;
    }
  }

  private toRefreshToken(record: {
    tokenHash: string;
    userId: string;
  }): RefreshToken {
    return {
      tokenHash: record.tokenHash,
      userId: record.userId,
    };
  }
}
