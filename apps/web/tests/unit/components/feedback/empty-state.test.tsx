import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/feedback/empty-state";

describe("EmptyState", () => {
  it("アイコン・タイトル・説明・children を表示する", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="チケットがありません"
        description="新しいチケットを作成してください"
      >
        <button>新規作成</button>
      </EmptyState>,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("チケットがありません")).toBeInTheDocument();
    expect(
      screen.getByText("新しいチケットを作成してください"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "新規作成" }),
    ).toBeInTheDocument();
  });

  it("最小限の props でも表示される", () => {
    render(<EmptyState title="データがありません" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });

  it("className が反映される", () => {
    render(<EmptyState title="データがありません" className="custom-class" />);
    expect(screen.getByTestId("empty-state")).toHaveClass("custom-class");
  });
});
