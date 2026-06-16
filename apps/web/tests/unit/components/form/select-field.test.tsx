import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectField } from "@/components/form/select-field";

const options = [
  { value: "open", label: "未対応" },
  { value: "in-progress", label: "対応中" },
  { value: "closed", label: "完了" },
];

describe("SelectField", () => {
  it("label と select trigger を表示する", () => {
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        placeholder="選択してください"
      />,
    );

    expect(screen.getByLabelText("状態")).toBeInTheDocument();
    expect(screen.getByText("選択してください")).toBeInTheDocument();
  });

  it("選択肢を選択できる", () => {
    const handleChange = vi.fn();
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        placeholder="選択してください"
        onValueChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("状態"));
    fireEvent.click(screen.getByText("対応中"));

    expect(handleChange).toHaveBeenCalledWith("in-progress");
  });

  it("helper text を表示する", () => {
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        helperText="チケットの状態を選択してください"
      />,
    );

    expect(
      screen.getByText("チケットの状態を選択してください"),
    ).toBeInTheDocument();
  });

  it("error text を表示する", () => {
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        error="状態は必須です"
      />,
    );

    expect(screen.getByText("状態は必須です")).toBeInTheDocument();
  });

  it("error 時に aria-invalid を true にする", () => {
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        error="必須です"
      />,
    );

    expect(screen.getByLabelText("状態")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("error 時に aria-describedby に error の id を含める", () => {
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        error="必須です"
      />,
    );

    const trigger = screen.getByLabelText("状態");
    expect(trigger).toHaveAttribute("aria-describedby", "status-error");
    expect(document.getElementById("status-error")).toHaveTextContent(
      "必須です",
    );
  });

  it("helper text がある場合に aria-describedby に description の id を含める", () => {
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        helperText="チケットの状態を選択してください"
      />,
    );

    const trigger = screen.getByLabelText("状態");
    expect(trigger).toHaveAttribute("aria-describedby", "status-description");
    expect(document.getElementById("status-description")).toHaveTextContent(
      "チケットの状態を選択してください",
    );
  });

  it("error と helper text の両方がある場合に両方の id を aria-describedby に含める", () => {
    render(
      <SelectField
        id="status"
        label="状態"
        options={options}
        helperText="チケットの状態を選択してください"
        error="必須です"
      />,
    );

    const trigger = screen.getByLabelText("状態");
    expect(trigger).toHaveAttribute(
      "aria-describedby",
      "status-description status-error",
    );
  });

  it("disabled 状態を扱える", () => {
    render(<SelectField id="status" label="状態" options={options} disabled />);

    expect(screen.getByLabelText("状態")).toBeDisabled();
  });

  it("loading 時に select trigger を disabled にする", () => {
    render(<SelectField id="status" label="状態" options={options} loading />);

    expect(screen.getByLabelText("状態")).toBeDisabled();
  });

  it("loading 時に送信中の表示をする", () => {
    render(<SelectField id="status" label="状態" options={options} loading />);

    expect(screen.getByText("送信中...")).toBeInTheDocument();
  });
});
