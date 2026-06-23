import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TicketListItem } from "./ticket-table-columns.js";
import { TicketTable } from "./ticket-table.js";

const sampleTickets: TicketListItem[] = [
  {
    id: "ticket-1",
    title: "ログイン画面の UI 改善",
    status: "open",
    priority: "medium",
    assignee: { id: "user-1", name: "山田太郎" },
  },
  {
    id: "ticket-2",
    title: "通知メール実装",
    status: "in-progress",
    priority: "high",
    assignee: null,
  },
  {
    id: "ticket-3",
    title: "ページネーション対応",
    status: "closed",
    priority: "low",
    assignee: { id: "user-3", name: null },
  },
];

describe("TicketTable", () => {
  it("ローディング状態を表示する", () => {
    render(<TicketTable isLoading />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("エラー状態を表示する", () => {
    const handleRetry = vi.fn();
    render(
      <TicketTable error={new Error("load failed")} onRetry={handleRetry} />,
    );
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("空状態を表示する", () => {
    render(<TicketTable tickets={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("チケット一覧を表示する", () => {
    render(<TicketTable tickets={sampleTickets} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("ログイン画面の UI 改善")).toBeInTheDocument();
    expect(screen.getByText("通知メール実装")).toBeInTheDocument();
  });

  it("ステータス・優先度・担当者を表示する", () => {
    render(<TicketTable tickets={sampleTickets} />);
    expect(screen.getByText("未対応")).toBeInTheDocument();
    expect(screen.getByText("対応中")).toBeInTheDocument();
    expect(screen.getByText("完了")).toBeInTheDocument();
    expect(screen.getByText("中")).toBeInTheDocument();
    expect(screen.getByText("高")).toBeInTheDocument();
    expect(screen.getByText("低")).toBeInTheDocument();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("未割当")).toBeInTheDocument();
    expect(screen.getByText("（ID: user-3）")).toBeInTheDocument();
  });

  it("行クリックで onRowClick を呼ぶ", () => {
    const handleRowClick = vi.fn();
    render(<TicketTable tickets={sampleTickets} onRowClick={handleRowClick} />);
    const row = screen.getByRole("button", { name: /ログイン画面の UI 改善/i });
    fireEvent.click(row);
    expect(handleRowClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick).toHaveBeenCalledWith(sampleTickets[0]);
  });

  it("Enter / Space キーで onRowClick を呼ぶ", () => {
    const handleRowClick = vi.fn();
    render(<TicketTable tickets={sampleTickets} onRowClick={handleRowClick} />);
    const row = screen.getByRole("button", { name: /ログイン画面の UI 改善/i });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(handleRowClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(row, { key: " " });
    expect(handleRowClick).toHaveBeenCalledTimes(2);
  });

  it("各行に ticket id の data 属性を持つ", () => {
    render(<TicketTable tickets={sampleTickets} />);
    const dataRows = document.querySelectorAll("[data-row-id]");
    expect(dataRows).toHaveLength(3);
    expect(dataRows[0]).toHaveAttribute("data-row-id", "ticket-1");
    expect(dataRows[1]).toHaveAttribute("data-row-id", "ticket-2");
    expect(dataRows[2]).toHaveAttribute("data-row-id", "ticket-3");
  });
});
