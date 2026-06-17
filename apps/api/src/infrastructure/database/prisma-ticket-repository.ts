import { PrismaClient, Prisma } from "@prisma/client";

import type { TicketRepository } from "../../domain/ticket-repository.js";
import type { Ticket, TicketId } from "../../domain/ticket.js";
import { rehydrateTicket } from "../../domain/ticket.js";

export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: TicketId): Promise<Ticket | null> {
    const record = await this.prisma.ticket.findUnique({ where: { id } });
    return record ? this.toTicket(record) : null;
  }

  async findAll(): Promise<readonly Ticket[]> {
    const records = await this.prisma.ticket.findMany();
    return records.map((record) => this.toTicket(record));
  }

  async save(entity: Ticket): Promise<void> {
    await this.prisma.ticket.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        title: entity.title,
        status: entity.status,
      },
      update: {
        title: entity.title,
        status: entity.status,
      },
    });
  }

  async delete(id: TicketId): Promise<void> {
    try {
      await this.prisma.ticket.delete({ where: { id } });
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

  private toTicket(record: {
    id: string;
    title: string;
    status: string;
  }): Ticket {
    return rehydrateTicket(record.id, record.title, record.status);
  }
}
