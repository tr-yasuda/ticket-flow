import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { TextField } from "@/components/form/text-field";
import { useAuthForm } from "@/hooks/use-auth-form";
import { ApiError } from "@/lib/api-client";

const schema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

type FormValues = {
  email: string;
  password: string;
};

function TestForm({
  onSubmit,
}: {
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useAuthForm({
    schema,
    defaultValues: { email: "", password: "" },
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
        name="email"
        children={(field) => (
          <TextField
            id="email"
            name="email"
            label="メールアドレス"
            type="email"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      />
      <form.Field
        name="password"
        children={(field) => (
          <TextField
            id="password"
            name="password"
            label="パスワード"
            type="password"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      />
      <button type="submit">送信</button>
    </form>
  );
}

describe("useAuthForm", () => {
  it("有効な入力で onSubmit を呼び出す", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password",
      });
    });
  });

  it("無効な入力で onSubmit を呼び出さずエラーを表示する", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスの形式が正しくありません"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("パスワードは8文字以上で入力してください"),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("サーバーエラーをフィールドに表示する", async () => {
    const error = new ApiError("入力内容を確認してください", 400, [
      { field: "email", message: "サーバー側でメールアドレスが無効です" },
    ]);
    const onSubmit = vi.fn().mockRejectedValue(error);
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(
        screen.getByText("サーバー側でメールアドレスが無効です"),
      ).toBeInTheDocument();
    });
  });
});
