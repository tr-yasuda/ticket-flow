import { render, screen } from "@testing-library/react";
import {
  ticketPrioritySchema,
  ticketStatusSchema,
  type TicketPriority,
  type TicketStatus,
} from "@ticket-flow/shared";
import { describe, expect, it } from "vitest";

import { RoleBadge } from "@/components/role-badge";
import { TicketPriorityBadge } from "@/components/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/ticket-status-badge";

const expectedStatusConfig: Record<
  TicketStatus,
  { label: string; variant: string }
> = {
  open: { label: "未対応", variant: "default" },
  "in-progress": { label: "対応中", variant: "secondary" },
  closed: { label: "完了", variant: "ghost" },
};

const expectedPriorityConfig: Record<
  TicketPriority,
  { label: string; variant: string }
> = {
  low: { label: "低", variant: "outline" },
  medium: { label: "中", variant: "secondary" },
  high: { label: "高", variant: "default" },
  urgent: { label: "緊急", variant: "destructive" },
};

describe("TicketStatusBadge", () => {
  it.each(ticketStatusSchema.options)(
    "%s を日本語ラベルと対応する variant で表示する",
    (status) => {
      const expected = expectedStatusConfig[status];
      render(<TicketStatusBadge status={status} />);

      const badge = screen.getByText(expected.label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-variant", expected.variant);
    },
  );

  it("未知の値を安全に表示する", () => {
    render(<TicketStatusBadge status="unknown" />);

    const badge = screen.getByText("不明");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "outline");
  });

  it("shared schema にない resolved を fallback 表示する", () => {
    render(<TicketStatusBadge status="resolved" />);

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
  it.each(ticketPrioritySchema.options)(
    "%s を日本語ラベルと対応する variant で表示する",
    (priority) => {
      const expected = expectedPriorityConfig[priority];
      render(<TicketPriorityBadge priority={priority} />);

      const badge = screen.getByText(expected.label);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-variant", expected.variant);
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
