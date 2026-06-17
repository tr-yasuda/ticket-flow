import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSpinner } from "@/components/feedback/loading-spinner";

describe("LoadingSpinner", () => {
  it("スピナーとメッセージを表示する", () => {
    render(<LoadingSpinner message="読み込み中…" />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });

  it("メッセージが未指定でも表示される", () => {
    render(<LoadingSpinner />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("className が反映される", () => {
    render(<LoadingSpinner className="custom-class" />);
    expect(screen.getByTestId("loading-spinner")).toHaveClass("custom-class");
  });
});
