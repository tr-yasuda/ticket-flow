import { useNavigate } from "@tanstack/react-router";
import { organizationSlugSchema } from "@ticket-flow/shared";
import type { ReactElement } from "react";

import { FormError } from "@/components/form/form-error";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOrganizationMembership } from "@/contexts/organization-membership-context";
import { useAuthForm } from "@/hooks/use-auth-form";
import { ApiError } from "@/lib/api-client";
import { createOrganization } from "@/lib/organizations-api";
import {
  organizationOnboardingSchema,
  type OrganizationOnboardingInput,
} from "@/lib/schemas/organization-onboarding-schema";
import { generateSlug } from "@/lib/slugs";

export function OrganizationOnboardingPage(): ReactElement {
  const navigate = useNavigate();
  const { refetch } = useOrganizationMembership();

  const form = useAuthForm<OrganizationOnboardingInput>({
    schema: organizationOnboardingSchema,
    defaultValues: { name: "" },
    onSubmit: async (values) => {
      const name = values.name.trim();
      const slug = generateSlug(name);
      const slugResult = organizationSlugSchema.safeParse(slug);
      if (!slugResult.success) {
        throw new ApiError(
          "組織名から有効な URL スラッグを生成できません。",
          400,
        );
      }

      try {
        await createOrganization({ name, slug });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          throw new ApiError("この組織 URL は既に使用されています。", 409);
        }
        throw error;
      }
      await refetch();
      navigate({ to: "/app", replace: true });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">組織を作成</CardTitle>
          <CardDescription>
            チケット管理を始めるために組織名を入力してください
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
              name="name"
              children={(field) => (
                <TextField
                  id="organization-name"
                  name="name"
                  label="組織名"
                  autoComplete="organization"
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
              {form.state.isSubmitting ? "作成中..." : "組織を作成"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
