import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  TicketCreateForm,
  type TicketCreateFormProps,
} from "@/components/tickets/ticket-create-form.js";
import { ApiError } from "@/lib/api-client";

const assigneeOptions = [
  {
    value: "00000000-0000-4000-8000-000000000001",
    label: "山田太郎",
  },
  {
    value: "00000000-0000-4000-8000-000000000002",
    label: "佐藤花子",
  },
];

function renderForm({
  onSubmit = vi.fn().mockResolvedValue(undefined),
}: {
  onSubmit?: TicketCreateFormProps["onSubmit"];
} = {}) {
  return {
    onSubmit,
    ...render(
      <TicketCreateForm
        assigneeOptions={assigneeOptions}
        onSubmit={onSubmit}
      />,
    ),
  };
}

describe("TicketCreateForm", () => {
  it("タイトル、説明、優先度、担当者の入力欄を表示する", () => {
    renderForm();

    expect(screen.getByLabelText("タイトル")).toBeInTheDocument();
    expect(screen.getByLabelText("説明")).toBeInTheDocument();
    expect(screen.getByLabelText("優先度")).toBeInTheDocument();
    expect(screen.getByLabelText("担当者")).toBeInTheDocument();
  });

  it("ステータス選択欄が存在しない", () => {
    renderForm();

    expect(screen.queryByLabelText("ステータス")).not.toBeInTheDocument();
  });

  it("タイトルが未入力のとき validation エラーを表示し onSubmit を呼ばない", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("タイトルを入力してください"),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("タイトルが空白のみのとき validation エラーを表示する", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "   ");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("タイトルを入力してください"),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("タイトルが201文字のとき validation エラーを表示する", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "valid title");
    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "a".repeat(201) },
    });
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("タイトルは200文字以内で入力してください"),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("タイトルが200文字のとき onSubmit を呼び出す", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    const title = "a".repeat(200);
    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: title },
    });
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title }));
    });
  });

  it("説明を入力できる", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("説明"), "Detailed description");

    expect(screen.getByLabelText("説明")).toHaveValue("Detailed description");
  });

  it("説明が未入力のとき onSubmit は description: null を受け取る", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "New ticket",
        description: null,
        priority: undefined,
        assigneeId: null,
      });
    });
  });

  it("説明が空白のみのとき onSubmit は description: null を受け取る", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.type(screen.getByLabelText("説明"), "   ");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "New ticket",
        description: null,
        priority: undefined,
        assigneeId: null,
      });
    });
  });

  it("説明が10001文字のとき validation エラーを表示する", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    fireEvent.change(screen.getByLabelText("説明"), {
      target: { value: "a".repeat(10001) },
    });
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("説明は10000文字以内で入力してください"),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("優先度を選択できる", async () => {
    renderForm();

    fireEvent.click(screen.getByLabelText("優先度"));
    fireEvent.click(screen.getByRole("option", { name: "高" }));

    await waitFor(() => {
      expect(screen.getByLabelText("優先度")).toHaveTextContent("高");
    });
  });

  it("担当者 options を props で受け取り、未割当も選択できる", async () => {
    renderForm();

    fireEvent.click(screen.getByLabelText("担当者"));
    fireEvent.click(screen.getByRole("option", { name: "山田太郎" }));

    await waitFor(() => {
      expect(screen.getByLabelText("担当者")).toHaveTextContent("山田太郎");
    });

    fireEvent.click(screen.getByLabelText("担当者"));
    fireEvent.click(screen.getByRole("option", { name: "未割当" }));

    await waitFor(() => {
      expect(screen.getByLabelText("担当者")).toHaveTextContent("未割当");
    });
  });

  it("有効な入力で onSubmit を呼び出す", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.type(screen.getByLabelText("説明"), "Description text");
    fireEvent.click(screen.getByLabelText("優先度"));
    fireEvent.click(screen.getByRole("option", { name: "高" }));
    await waitFor(() => {
      expect(screen.getByLabelText("優先度")).toHaveTextContent("高");
    });
    fireEvent.click(screen.getByLabelText("担当者"));
    fireEvent.click(screen.getByRole("option", { name: "佐藤花子" }));
    await waitFor(() => {
      expect(screen.getByLabelText("担当者")).toHaveTextContent("佐藤花子");
    });
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "New ticket",
        description: "Description text",
        priority: "high",
        assigneeId: assigneeOptions[1].value,
      });
    });
  });

  it("未割当を選択して submit すると assigneeId: null になる", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    fireEvent.click(screen.getByLabelText("担当者"));
    fireEvent.click(screen.getByRole("option", { name: "未割当" }));
    await waitFor(() => {
      expect(screen.getByLabelText("担当者")).toHaveTextContent("未割当");
    });
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "New ticket",
        description: null,
        priority: undefined,
        assigneeId: null,
      });
    });
  });

  it("submit 中に submit button が disabled になり二重送信しない", async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn(() => submitPromise);
    renderForm({ onSubmit });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    const button = screen.getByRole("button", { name: "作成" });
    await user.click(button);
    await user.click(button);

    expect(
      await screen.findByRole("button", { name: "作成中..." }),
    ).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit!();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "作成" })).toBeEnabled();
    });
  });

  it("送信成功後にフォームがリセットされる", async () => {
    const { onSubmit } = renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.type(screen.getByLabelText("説明"), "Description text");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByLabelText("タイトル")).toHaveValue("");
    });
    expect(screen.getByLabelText("説明")).toHaveValue("");
  });

  it("サーバーエラーの field details を表示する", async () => {
    const error = new ApiError("入力内容を確認してください", 400, [
      { field: "title", message: "サーバー側でタイトルが無効です" },
    ]);
    const { onSubmit } = renderForm({
      onSubmit: vi.fn().mockRejectedValue(error),
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(
        screen.getByText("サーバー側でタイトルが無効です"),
      ).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("フィールド以外のサーバーエラーをフォーム全体に表示する", async () => {
    const { onSubmit } = renderForm({
      onSubmit: vi
        .fn()
        .mockRejectedValue(new ApiError("Internal server error", 500)),
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "処理に失敗しました。時間をおいて再度お試しください。",
        ),
      ).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("ApiError 以外のエラーをフォーム全体に表示する", async () => {
    const { onSubmit } = renderForm({
      onSubmit: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("タイトル"), "New ticket");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "処理に失敗しました。時間をおいて再度お試しください。",
        ),
      ).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
