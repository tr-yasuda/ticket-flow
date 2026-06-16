import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextField } from "@/components/form/text-field";

describe("TextField", () => {
  it("label と input を表示する", () => {
    render(<TextField id="email" label="メールアドレス" />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
  });

  it("placeholder を表示する", () => {
    render(
      <TextField
        id="email"
        label="メールアドレス"
        placeholder="user@example.com"
      />,
    );

    expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
  });

  it("helper text を表示する", () => {
    render(
      <TextField
        id="email"
        label="メールアドレス"
        helperText="会社用のメールアドレスを入力してください"
      />,
    );

    expect(
      screen.getByText("会社用のメールアドレスを入力してください"),
    ).toBeInTheDocument();
  });

  it("error text を表示する", () => {
    render(
      <TextField
        id="email"
        label="メールアドレス"
        error="メールアドレスは必須です"
      />,
    );

    expect(screen.getByText("メールアドレスは必須です")).toBeInTheDocument();
  });

  it("error 時に aria-invalid を true にする", () => {
    render(<TextField id="email" label="メールアドレス" error="必須です" />);

    expect(screen.getByLabelText("メールアドレス")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("error 時に aria-describedby に error の id を含める", () => {
    render(<TextField id="email" label="メールアドレス" error="必須です" />);

    const input = screen.getByLabelText("メールアドレス");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
    expect(document.getElementById("email-error")).toHaveTextContent(
      "必須です",
    );
  });

  it("helper text がある場合に aria-describedby に description の id を含める", () => {
    render(
      <TextField
        id="email"
        label="メールアドレス"
        helperText="会社用のメールアドレスを入力してください"
      />,
    );

    const input = screen.getByLabelText("メールアドレス");
    expect(input).toHaveAttribute("aria-describedby", "email-description");
    expect(document.getElementById("email-description")).toHaveTextContent(
      "会社用のメールアドレスを入力してください",
    );
  });

  it("error と helper text の両方がある場合に両方の id を aria-describedby に含める", () => {
    render(
      <TextField
        id="email"
        label="メールアドレス"
        helperText="会社用のメールアドレスを入力してください"
        error="必須です"
      />,
    );

    const input = screen.getByLabelText("メールアドレス");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "email-description email-error",
    );
  });

  it("error と helper text の両方がある場合に両方のテキストを表示する", () => {
    render(
      <TextField
        id="email"
        label="メールアドレス"
        helperText="会社用のメールアドレスを入力してください"
        error="必須です"
      />,
    );

    expect(screen.getByText("必須です")).toBeInTheDocument();
    expect(
      screen.getByText("会社用のメールアドレスを入力してください"),
    ).toBeInTheDocument();
  });

  it("disabled 状態を扱える", () => {
    render(<TextField id="email" label="メールアドレス" disabled />);

    expect(screen.getByLabelText("メールアドレス")).toBeDisabled();
  });

  it("loading 時に input を disabled にする", () => {
    render(<TextField id="email" label="メールアドレス" loading />);

    expect(screen.getByLabelText("メールアドレス")).toBeDisabled();
  });

  it("loading 時に送信中の表示をする", () => {
    render(<TextField id="email" label="メールアドレス" loading />);

    expect(screen.getByText("送信中...")).toBeInTheDocument();
  });
});
