import { Link, useNavigate } from "@tanstack/react-router";
import { loginInputSchema } from "@ticket-flow/shared";
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
import { useAuth } from "@/contexts/auth-context";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { login } from "@/lib/auth-api";

export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const { login: authenticate } = useAuth();
  const form = useValidatedForm({
    schema: loginInputSchema,
    defaultValues: { email: "", password: "" },
    onSubmit: async (values) => {
      const response = await login(values);
      authenticate(response);
      navigate({ to: "/app", replace: true });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">ログイン</CardTitle>
          <CardDescription>
            アカウントにログインして続けましょう
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
                  autoComplete="current-password"
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
              {form.state.isSubmitting ? "ログイン中..." : "ログイン"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              アカウントをお持ちでないですか？{" "}
              <Link to="/signup" className="text-primary hover:underline">
                新規登録
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
