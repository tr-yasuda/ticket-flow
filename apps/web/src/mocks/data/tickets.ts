import type { TicketPriority, TicketStatus } from "@ticket-flow/shared";

import { demoOrganization } from "./organizations.js";

export type MockTicketAssignee = Readonly<{
  id: string;
  name: string | null;
}>;

export type MockTicket = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: MockTicketAssignee | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}>;

export type MockTicketListItem = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: MockTicketAssignee | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}>;

const now = new Date().toISOString();

export const demoTickets: MockTicket[] = [
  {
    id: "demo-ticket-001",
    organizationId: demoOrganization.id,
    title: "ログイン画面の UI 改善",
    description: null,
    status: "open",
    priority: "medium",
    assignee: { id: "demo-user-001", name: "山田太郎" },
    createdBy: "demo-user-001",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "demo-ticket-002",
    organizationId: demoOrganization.id,
    title: "チケット作成時の通知メール実装",
    description: null,
    status: "in-progress",
    priority: "high",
    assignee: { id: "demo-user-002", name: "佐藤花子" },
    createdBy: "demo-user-001",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "demo-ticket-003",
    organizationId: demoOrganization.id,
    title: "ユーザー一覧のページネーション対応",
    description: null,
    status: "closed",
    priority: "low",
    assignee: null,
    createdBy: "demo-user-001",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "demo-ticket-004",
    organizationId: demoOrganization.id,
    title: "組織設定画面のバリデーション強化",
    description: null,
    status: "open",
    priority: "urgent",
    assignee: { id: "demo-user-003", name: "田中一郎" },
    createdBy: "demo-user-001",
    createdAt: now,
    updatedAt: now,
  },
];
