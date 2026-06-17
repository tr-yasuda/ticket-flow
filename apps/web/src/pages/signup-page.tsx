import { Link, useNavigate } from "@tanstack/react-router";
import { registerInputSchema } from "@ticket-flow/shared";
import type { ReactElement } from "react";

import { FormError } from "@/components/form/form-error";
import { PasswordField } from "@/components/form/password-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthForm } from "@/hooks/use-auth-form";
import { register } from "@/lib/auth-api";
import { clearTokens } from "@/lib/token-storage";

export function SignupPage(): ReactElement {
  const navigate = useNavigate();
  const form = useAuthForm({
    schema: registerInputSchema,
    defaultValues: { email: "", password: "" },
    onSubmit: async (values) => {
      await register(values);
      clearTokens();
      navigate({ to: "/login", replace: true });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">新規登録</CardTitle>
          <CardDescription>
            アカウントを作成してチケット管理を始めましょう
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
            className="grid gap-4"
          >
            <form.Field
              name="email"
              children={(field) => (
                <TextField
                  id="email"
                  name="email"
                  label="メールアドレス"
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  error={field.state.meta.errors.join(", ")}
                  disabled={form.state.isSubmitting}
                />
              )}
            />
            <form.Field
              name="password"
              children={(field) => (
                <PasswordField
                  id="password"
                  name="password"
                  label="パスワード"
                  autoComplete="new-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  error={field.state.meta.errors.join(", ")}
                  disabled={form.state.isSubmitting}
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
            <Button type="submit" disabled={form.state.isSubmitting}>
              {form.state.isSubmitting ? "登録中..." : "アカウントを作成"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              既にアカウントをお持ちですか？{" "}
              <Link to="/login" className="text-primary hover:underline">
                ログイン
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
