import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTicket } from "../../../../src/domain/ticket.js";
import { loadDatabaseConfig } from "../../../../src/infrastructure/database/config.js";
import { createPrismaClient } from "../../../../src/infrastructure/database/prisma-client.js";
import { PrismaTicketRepository } from "../../../../src/infrastructure/database/prisma-ticket-repository.js";

const config = loadDatabaseConfig(process.env);
const prisma = createPrismaClient(config);
const repository = new PrismaTicketRepository(prisma);

async function cleanTickets(): Promise<void> {
  await prisma.ticket.deleteMany();
}

describe("PrismaTicketRepository 統合テスト", () => {
  beforeEach(cleanTickets);
  afterAll(async () => {
    await cleanTickets();
    await prisma.$disconnect();
  });

  it("findById で保存したチケットを取得できる", async () => {
    const ticket = createTicket("ticket-1", "Initial title");
    await repository.save(ticket);

    const found = await repository.findById(ticket.id);

    expect(found).toEqual(ticket);
  });

  it("findById で存在しない ID に対して null を返す", async () => {
    const found = await repository.findById("not-found");

    expect(found).toBeNull();
  });

  it("findAll で保存したすべてのチケットを取得できる", async () => {
    const ticket1 = createTicket("ticket-1", "Title 1");
    const ticket2 = createTicket("ticket-2", "Title 2");
    await repository.save(ticket1);
    await repository.save(ticket2);

    const all = await repository.findAll();

    expect(all).toHaveLength(2);
    expect(all).toContainEqual(ticket1);
    expect(all).toContainEqual(ticket2);
  });

  it("save で既存チケットを上書き更新できる", async () => {
    const ticket = createTicket("ticket-1", "Old title");
    await repository.save(ticket);

    const updated = {
      ...ticket,
      title: "New title",
      status: "in-progress" as const,
    };
    await repository.save(updated);

    const found = await repository.findById(ticket.id);
    expect(found).toEqual(updated);
  });

  it("delete でチケットを削除できる", async () => {
    const ticket = createTicket("ticket-1", "Title");
    await repository.save(ticket);

    await repository.delete(ticket.id);

    const found = await repository.findById(ticket.id);
    expect(found).toBeNull();
  });

  it("delete で存在しない ID でも例外を投げない", async () => {
    await expect(repository.delete("missing-id")).resolves.toBeUndefined();
  });
});
