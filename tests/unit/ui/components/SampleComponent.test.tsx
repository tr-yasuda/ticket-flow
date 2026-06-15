// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SampleComponent } from "../../../../src/ui/components/SampleComponent";

describe("SampleComponent", () => {
  it("タイトルを表示する", () => {
    render(<SampleComponent title="テストタイトル" />);

    expect(
      screen.getByRole("heading", { name: "テストタイトル" }),
    ).toBeInTheDocument();
  });

  it("説明文を表示する", () => {
    render(<SampleComponent title="テストタイトル" />);

    expect(
      screen.getByText(
        "ticket-flow のフロントエンド基盤が動作しています。",
      ),
    ).toBeInTheDocument();
  });
});
