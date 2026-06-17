import { demoOrganization } from "./organizations.js";

export type MockTicket = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  status: "open" | "in-progress" | "closed";
}>;

export const demoTickets: MockTicket[] = [
  {
    id: "demo-ticket-001",
    organizationId: demoOrganization.id,
    title: "ログイン画面の UI 改善",
    status: "open",
  },
  {
    id: "demo-ticket-002",
    organizationId: demoOrganization.id,
    title: "チケット作成時の通知メール実装",
    status: "in-progress",
  },
  {
    id: "demo-ticket-003",
    organizationId: demoOrganization.id,
    title: "ユーザー一覧のページネーション対応",
    status: "closed",
  },
  {
    id: "demo-ticket-004",
    organizationId: demoOrganization.id,
    title: "組織設定画面のバリデーション強化",
    status: "open",
  },
];
