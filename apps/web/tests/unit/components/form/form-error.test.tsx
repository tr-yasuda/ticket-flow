import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormError } from "@/components/form/form-error";

describe("FormError", () => {
  it("エラーメッセージを表示する", () => {
    render(<FormError message="入力内容に誤りがあります" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "入力内容に誤りがあります",
    );
  });

  it("複数行のメッセージを表示する", () => {
    render(<FormError message="メールアドレスが既に登録されています" />);

    expect(
      screen.getByText("メールアドレスが既に登録されています"),
    ).toBeInTheDocument();
  });
});
