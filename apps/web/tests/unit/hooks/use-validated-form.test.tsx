import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { FormError } from "@/components/form/form-error";
import { TextField } from "@/components/form/text-field";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { ApiError } from "@/lib/api-client";

const schema = z.object({
  title: z.string().min(1, "タイトルを入力してください"),
  body: z.string().optional(),
});

type FormValues = {
  title: string;
  body?: string;
};

function TestForm({
  onSubmit,
}: {
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useValidatedForm({
    schema,
    defaultValues: { title: "", body: "" },
    onSubmit,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      data-testid="form"
    >
      <form.Field
        name="title"
        children={(field) => (
          <TextField
            id="title"
            name="title"
            label="タイトル"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      />
      <form.Field
        name="body"
        children={(field) => (
          <TextField
            id="body"
            name="body"
            label="本文"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      />
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(formError) =>
          typeof formError === "string" ? (
            <FormError message={formError} />
          ) : null
        }
      </form.Subscribe>
      <button type="submit">送信</button>
    </form>
  );
}

describe("useValidatedForm", () => {
  it("有効な入力で onSubmit を呼び出す", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "テストチケット" },
    });
    fireEvent.change(screen.getByLabelText("本文"), {
      target: { value: "詳細な説明" },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "テストチケット",
        body: "詳細な説明",
      });
    });
  });

  it("無効な入力で onSubmit を呼び出さずエラーを表示する", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(
        screen.getByText("タイトルを入力してください"),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("サーバーエラーをフィールドに表示する", async () => {
    const error = new ApiError("入力内容を確認してください", 400, [
      { field: "title", message: "サーバー側でタイトルが無効です" },
    ]);
    const onSubmit = vi.fn().mockRejectedValue(error);
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "テストチケット" },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(
        screen.getByText("サーバー側でタイトルが無効です"),
      ).toBeInTheDocument();
    });
  });

  it("フィールド以外のサーバーエラーをフォーム全体に表示する", async () => {
    const error = new ApiError("Internal server error", 500);
    const onSubmit = vi.fn().mockRejectedValue(error);
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "テストチケット" },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "処理に失敗しました。時間をおいて再度お試しください。",
        ),
      ).toBeInTheDocument();
    });
  });
});
