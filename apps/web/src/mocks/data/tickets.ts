import { demoOrganization } from "./organizations.js";

export type MockTicketAssignee = Readonly<{
  id: string;
  name: string;
}>;

export type MockTicketPriority = "low" | "medium" | "high" | "urgent";

export type MockTicket = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  status: "open" | "in-progress" | "closed";
  priority: MockTicketPriority;
  assignee: MockTicketAssignee | null;
}>;

export const demoTickets: MockTicket[] = [
  {
    id: "demo-ticket-001",
    organizationId: demoOrganization.id,
    title: "ログイン画面の UI 改善",
    status: "open",
    priority: "medium",
    assignee: { id: "demo-user-001", name: "山田太郎" },
  },
  {
    id: "demo-ticket-002",
    organizationId: demoOrganization.id,
    title: "チケット作成時の通知メール実装",
    status: "in-progress",
    priority: "high",
    assignee: { id: "demo-user-002", name: "佐藤花子" },
  },
  {
    id: "demo-ticket-003",
    organizationId: demoOrganization.id,
    title: "ユーザー一覧のページネーション対応",
    status: "closed",
    priority: "low",
    assignee: null,
  },
  {
    id: "demo-ticket-004",
    organizationId: demoOrganization.id,
    title: "組織設定画面のバリデーション強化",
    status: "open",
    priority: "urgent",
    assignee: { id: "demo-user-003", name: "田中一郎" },
  },
];
