import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextareaField } from "@/components/form/textarea-field";

describe("TextareaField", () => {
  it("label と textarea を表示する", () => {
    render(<TextareaField id="description" label="詳細" />);

    expect(screen.getByLabelText("詳細")).toBeInTheDocument();
  });

  it("placeholder を表示する", () => {
    render(
      <TextareaField id="description" label="詳細" placeholder="内容を入力" />,
    );

    expect(screen.getByPlaceholderText("内容を入力")).toBeInTheDocument();
  });

  it("helper text を表示する", () => {
    render(
      <TextareaField
        id="description"
        label="詳細"
        helperText="1000文字以内で入力してください"
      />,
    );

    expect(
      screen.getByText("1000文字以内で入力してください"),
    ).toBeInTheDocument();
  });

  it("error text を表示する", () => {
    render(
      <TextareaField id="description" label="詳細" error="詳細は必須です" />,
    );

    expect(screen.getByText("詳細は必須です")).toBeInTheDocument();
  });

  it("error 時に aria-invalid を true にする", () => {
    render(<TextareaField id="description" label="詳細" error="必須です" />);

    expect(screen.getByLabelText("詳細")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("error 時に aria-describedby に error の id を含める", () => {
    render(<TextareaField id="description" label="詳細" error="必須です" />);

    const textarea = screen.getByLabelText("詳細");
    expect(textarea).toHaveAttribute("aria-describedby", "description-error");
    expect(document.getElementById("description-error")).toHaveTextContent(
      "必須です",
    );
  });

  it("helper text がある場合に aria-describedby に description の id を含める", () => {
    render(
      <TextareaField
        id="description"
        label="詳細"
        helperText="1000文字以内で入力してください"
      />,
    );

    const textarea = screen.getByLabelText("詳細");
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "description-description",
    );
    expect(
      document.getElementById("description-description"),
    ).toHaveTextContent("1000文字以内で入力してください");
  });

  it("error と helper text の両方がある場合に両方の id を aria-describedby に含める", () => {
    render(
      <TextareaField
        id="description"
        label="詳細"
        helperText="1000文字以内で入力してください"
        error="必須です"
      />,
    );

    const textarea = screen.getByLabelText("詳細");
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "description-description description-error",
    );
  });

  it("disabled 状態を扱える", () => {
    render(<TextareaField id="description" label="詳細" disabled />);

    expect(screen.getByLabelText("詳細")).toBeDisabled();
  });

  it("loading 時に textarea を disabled にする", () => {
    render(<TextareaField id="description" label="詳細" loading />);

    expect(screen.getByLabelText("詳細")).toBeDisabled();
  });

  it("loading 時に送信中の表示をする", () => {
    render(<TextareaField id="description" label="詳細" loading />);

    expect(screen.getByText("送信中...")).toBeInTheDocument();
  });
});
