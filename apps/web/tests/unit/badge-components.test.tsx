import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleBadge } from "@/components/role-badge";
import { TicketPriorityBadge } from "@/components/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/ticket-status-badge";

describe("TicketStatusBadge", () => {
  it.each([
    ["open", "未対応", "default"],
    ["in-progress", "対応中", "secondary"],
    ["resolved", "解決済み", "outline"],
    ["closed", "完了", "ghost"],
  ] as const)(
    "%s を日本語ラベルと対応する variant で表示する",
    (status, expectedLabel, expectedVariant) => {
      render(<TicketStatusBadge status={status} />);

      const badge = screen.getByText(expectedLabel);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-variant", expectedVariant);
    },
  );

  it("未知の値を安全に表示する", () => {
    render(<TicketStatusBadge status="unknown" />);

    const badge = screen.getByText("不明");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "outline");
  });

  it("プロトタイプ汚染されたキーを無視して fallback 表示する", () => {
    render(<TicketStatusBadge status="toString" />);

    const badge = screen.getByText("不明");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "outline");
  });
});

describe("TicketPriorityBadge", () => {
  it.each([
    ["low", "低", "outline"],
    ["medium", "中", "secondary"],
    ["high", "高", "default"],
    ["urgent", "緊急", "destructive"],
  ] as const)(
    "%s を日本語ラベルと対応する variant で表示する",
    (priority, expectedLabel, expectedVariant) => {
      render(<TicketPriorityBadge priority={priority} />);

      const badge = screen.getByText(expectedLabel);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-variant", expectedVariant);
    },
  );

  it("未知の値を安全に表示する", () => {
    render(<TicketPriorityBadge priority="unknown" />);

    const badge = screen.getByText("不明");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "outline");
  });
});

describe("RoleBadge", () => {
  it.each([
    ["owner", "オーナー", "default"],
    ["admin", "管理者", "secondary"],
    ["member", "メンバー", "outline"],
    ["viewer", "閲覧者", "ghost"],
  ] as const)(
    "%s を日本語ラベルと対応する variant で表示する",
    (role, expectedLabel, expectedVariant) => {
      render(<RoleBadge role={role} />);

      const badge = screen.getByText(expectedLabel);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-variant", expectedVariant);
    },
  );

  it("未知の値を安全に表示する", () => {
    render(<RoleBadge role="unknown" />);

    const badge = screen.getByText("不明");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "outline");
  });
});
