import type { TicketRepository } from "../../domain/ticket-repository.js";
import type { Ticket, TicketId } from "../../domain/ticket.js";
import { InMemoryRepository } from "./in-memory-repository.js";

export class InMemoryTicketRepository implements TicketRepository {
  private readonly repository = new InMemoryRepository<Ticket, TicketId>(
    (ticket) => ticket.id,
  );

  async findById(id: TicketId): Promise<Ticket | null> {
    return this.repository.findById(id);
  }

  async findAll(): Promise<readonly Ticket[]> {
    return this.repository.findAll();
  }

  async save(entity: Ticket): Promise<void> {
    return this.repository.save(entity);
  }

  async delete(id: TicketId): Promise<void> {
    return this.repository.delete(id);
  }
}
