import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordField } from "@/components/form/password-field";

describe("PasswordField", () => {
  it("label と input を表示する", () => {
    render(<PasswordField id="password" label="パスワード" />);

    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
  });

  it("初期状態は password タイプ", () => {
    render(<PasswordField id="password" label="パスワード" />);

    expect(screen.getByLabelText("パスワード")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("目くらし切替ボタンで text タイプに切り替わる", () => {
    render(<PasswordField id="password" label="パスワード" />);

    const toggleButton = screen.getByRole("button", {
      name: "パスワードを表示",
    });
    fireEvent.click(toggleButton);

    expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "text");
  });

  it("もう一度切替ボタンを押すと password タイプに戻る", () => {
    render(<PasswordField id="password" label="パスワード" />);

    const toggleButton = screen.getByRole("button", {
      name: "パスワードを表示",
    });
    fireEvent.click(toggleButton);
    fireEvent.click(screen.getByRole("button", { name: "パスワードを隠す" }));

    expect(screen.getByLabelText("パスワード")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("error 時に aria-invalid を true にする", () => {
    render(<PasswordField id="password" label="パスワード" error="必須です" />);

    expect(screen.getByLabelText("パスワード")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("error 時に aria-describedby に error の id を含める", () => {
    render(<PasswordField id="password" label="パスワード" error="必須です" />);

    const input = screen.getByLabelText("パスワード");
    expect(input).toHaveAttribute("aria-describedby", "password-error");
    expect(document.getElementById("password-error")).toHaveTextContent(
      "必須です",
    );
  });

  it("disabled 状態を扱える", () => {
    render(<PasswordField id="password" label="パスワード" disabled />);

    expect(screen.getByLabelText("パスワード")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "パスワードを表示" }),
    ).toBeDisabled();
  });

  it("loading 時に input と toggle ボタンを disabled にする", () => {
    render(<PasswordField id="password" label="パスワード" loading />);

    expect(screen.getByLabelText("パスワード")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "パスワードを表示" }),
    ).toBeDisabled();
  });

  it("loading 時に送信中の表示をする", () => {
    render(<PasswordField id="password" label="パスワード" loading />);

    expect(screen.getByText("送信中...")).toBeInTheDocument();
  });
});
