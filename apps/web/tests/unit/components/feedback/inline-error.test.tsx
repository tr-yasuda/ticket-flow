import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineError } from "@/components/feedback/inline-error";

describe("InlineError", () => {
  it("エラーメッセージを表示する", () => {
    render(<InlineError message="取得に失敗しました" />);
    expect(screen.getByTestId("inline-error")).toBeInTheDocument();
    expect(screen.getByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("onRetry が指定された場合、再試行ボタンを表示する", () => {
    const onRetry = vi.fn();
    render(<InlineError message="取得に失敗しました" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
