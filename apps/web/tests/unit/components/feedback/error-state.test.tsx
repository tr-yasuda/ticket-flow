import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/feedback/error-state";

describe("ErrorState", () => {
  it("タイトル・メッセージを表示する", () => {
    render(
      <ErrorState
        title="取得に失敗しました"
        message="接続を確認して、もう一度お試しください。"
      />,
    );
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
    expect(screen.getByText("取得に失敗しました")).toBeInTheDocument();
    expect(
      screen.getByText("接続を確認して、もう一度お試しください。"),
    ).toBeInTheDocument();
  });

  it("onRetry が指定された場合、再試行ボタンを表示する", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="取得に失敗しました"
        message="エラーです"
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("className が反映される", () => {
    render(<ErrorState message="エラーです" className="custom-class" />);
    expect(screen.getByTestId("error-state")).toHaveClass("custom-class");
  });
});
