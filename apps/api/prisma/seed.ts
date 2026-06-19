import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/domain/password.js";
import { TicketStatus } from "../src/domain/ticket.js";

const DEMO_USER_EMAIL = "demo@example.com";
const DEMO_USER_PASSWORD = "demo1234";
const DEMO_USER_ID = "demo-user-001";
const DEMO_ORGANIZATION_ID = "demo-organization-001";
const DEMO_ORGANIZATION_SLUG = "demo-organization";
const DEMO_MEMBER_ID = "demo-member-001";

const DEMO_TICKETS: readonly {
  id: string;
  title: string;
  status: (typeof TicketStatus)[keyof typeof TicketStatus];
}[] = [
  {
    id: "demo-ticket-001",
    title: "ログイン画面の UI 改善",
    status: TicketStatus.Open,
  },
  {
    id: "demo-ticket-002",
    title: "チケット作成時の通知メール実装",
    status: TicketStatus.InProgress,
  },
  {
    id: "demo-ticket-003",
    title: "ユーザー一覧のページネーション対応",
    status: TicketStatus.Closed,
  },
  {
    id: "demo-ticket-004",
    title: "組織設定画面のバリデーション強化",
    status: TicketStatus.Open,
  },
] as const;

function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed scripts must not run in production environment");
  }
}

async function seedDemoUser(prisma: PrismaClient): Promise<string> {
  const passwordHash = await hashPassword(DEMO_USER_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      passwordHash,
    },
    update: {
      passwordHash,
    },
  });

  console.log(`Seeded demo user: ${DEMO_USER_EMAIL}`);
  return user.id;
}

async function seedDemoOrganization(
  prisma: PrismaClient,
  ownerUserId: string,
): Promise<string> {
  await prisma.organization.upsert({
    where: { id: DEMO_ORGANIZATION_ID },
    create: {
      id: DEMO_ORGANIZATION_ID,
      name: "Demo Organization",
      slug: DEMO_ORGANIZATION_SLUG,
    },
    update: {
      name: "Demo Organization",
      slug: DEMO_ORGANIZATION_SLUG,
    },
  });

  await prisma.organizationMember.upsert({
    where: { id: DEMO_MEMBER_ID },
    create: {
      id: DEMO_MEMBER_ID,
      organizationId: DEMO_ORGANIZATION_ID,
      userId: ownerUserId,
      role: "owner",
    },
    update: {
      role: "owner",
    },
  });

  console.log("Seeded demo organization: Demo Organization");
  return DEMO_ORGANIZATION_ID;
}

async function seedDemoTickets(
  prisma: PrismaClient,
  organizationId: string,
  createdBy: string,
): Promise<void> {
  await Promise.all(
    DEMO_TICKETS.map((ticket) =>
      prisma.ticket.upsert({
        where: { id: ticket.id },
        create: {
          id: ticket.id,
          organizationId,
          title: ticket.title,
          status: ticket.status,
          createdBy,
        },
        update: {
          organizationId,
          title: ticket.title,
          status: ticket.status,
          createdBy,
        },
      }),
    ),
  );

  console.log(`Seeded ${DEMO_TICKETS.length} demo tickets`);
}

async function main(): Promise<void> {
  assertNotProduction();

  const prisma = new PrismaClient();

  try {
    const userId = await seedDemoUser(prisma);
    const organizationId = await seedDemoOrganization(prisma, userId);
    await seedDemoTickets(prisma, organizationId, userId);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to seed demo data:", error);
  process.exit(1);
});
