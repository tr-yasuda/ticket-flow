import type { PrismaClient } from "@prisma/client";

import type { UserRepository } from "../../domain/user-repository.js";
import type { User } from "../../domain/user.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toUser(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return record ? this.toUser(record) : null;
  }

  async findAll(): Promise<readonly User[]> {
    const records = await this.prisma.user.findMany();
    return records.map((record) => this.toUser(record));
  }

  async save(entity: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        email: entity.email,
        passwordHash: entity.passwordHash,
      },
      update: {
        email: entity.email,
        passwordHash: entity.passwordHash,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  private toUser(record: {
    id: string;
    email: string;
    passwordHash: string;
  }): User {
    return {
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
    };
  }
}
