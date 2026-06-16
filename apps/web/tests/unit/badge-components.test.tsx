import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleBadge } from "@/components/role-badge";
import { TicketPriorityBadge } from "@/components/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/ticket-status-badge";

describe("TicketStatusBadge", () => {
  it.each([
    ["open", "未対応"],
    ["in_progress", "対応中"],
    ["resolved", "解決済み"],
    ["closed", "完了"],
  ] as const)("%s を日本語ラベルで表示する", (status, expectedLabel) => {
    render(<TicketStatusBadge status={status} />);

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it("未知の値を安全に表示する", () => {
    render(<TicketStatusBadge status="unknown" />);

    expect(screen.getByText("不明")).toBeInTheDocument();
  });
});

describe("TicketPriorityBadge", () => {
  it.each([
    ["low", "低"],
    ["medium", "中"],
    ["high", "高"],
    ["urgent", "緊急"],
  ] as const)("%s を日本語ラベルで表示する", (priority, expectedLabel) => {
    render(<TicketPriorityBadge priority={priority} />);

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it("未知の値を安全に表示する", () => {
    render(<TicketPriorityBadge priority="unknown" />);

    expect(screen.getByText("不明")).toBeInTheDocument();
  });
});

describe("RoleBadge", () => {
  it.each([
    ["owner", "オーナー"],
    ["admin", "管理者"],
    ["member", "メンバー"],
    ["viewer", "閲覧者"],
  ] as const)("%s を日本語ラベルで表示する", (role, expectedLabel) => {
    render(<RoleBadge role={role} />);

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it("未知の値を安全に表示する", () => {
    render(<RoleBadge role="unknown" />);

    expect(screen.getByText("不明")).toBeInTheDocument();
  });
});
