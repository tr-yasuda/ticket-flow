import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/domain/password.js";

const DEMO_USER_EMAIL = "demo@example.com";
const DEMO_USER_PASSWORD = "demo1234";

const DEMO_TICKETS = [
  {
    id: "demo-ticket-001",
    title: "ログイン画面の UI 改善",
    status: "open",
  },
  {
    id: "demo-ticket-002",
    title: "チケット作成時の通知メール実装",
    status: "in-progress",
  },
  {
    id: "demo-ticket-003",
    title: "ユーザー一覧のページネーション対応",
    status: "closed",
  },
  {
    id: "demo-ticket-004",
    title: "組織設定画面のバリデーション強化",
    status: "open",
  },
] as const;

function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed scripts must not run in production environment");
  }
}

async function seedDemoUser(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hashPassword(DEMO_USER_PASSWORD);

  await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: {
      id: "demo-user-001",
      email: DEMO_USER_EMAIL,
      passwordHash,
    },
    update: {
      passwordHash,
    },
  });

  console.log(`Seeded demo user: ${DEMO_USER_EMAIL}`);
}

async function seedDemoTickets(prisma: PrismaClient): Promise<void> {
  for (const ticket of DEMO_TICKETS) {
    await prisma.ticket.upsert({
      where: { id: ticket.id },
      create: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
      },
      update: {
        title: ticket.title,
        status: ticket.status,
      },
    });
  }

  console.log(`Seeded ${DEMO_TICKETS.length} demo tickets`);
}

async function main(): Promise<void> {
  assertNotProduction();

  const prisma = new PrismaClient();

  try {
    await seedDemoUser(prisma);
    await seedDemoTickets(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to seed demo data:", error);
  process.exit(1);
});
