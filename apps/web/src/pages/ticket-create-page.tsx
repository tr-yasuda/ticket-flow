import { useNavigate } from "@tanstack/react-router";
import type { TicketPriority } from "@ticket-flow/shared";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import { FormError } from "@/components/form/form-error";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApiErrorHandler } from "@/hooks/use-api-error-handler";
import { useValidatedForm } from "@/hooks/use-validated-form";
import {
  getOrganizationMembers,
  type OrganizationMember,
} from "@/lib/organization-members-api";
import {
  createTicketFormSchema,
  type CreateTicketFormInput,
} from "@/lib/schemas/ticket-create-schema";
import { createTicket } from "@/lib/tickets-api";

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "緊急" },
];

const UNASSIGNED_VALUE = "__UNASSIGNED__";

export type TicketCreatePageProps = {
  organizationId: string;
};

export function TicketCreatePage({
  organizationId,
}: TicketCreatePageProps): ReactElement {
  const navigate = useNavigate();
  const { handleApiError } = useApiErrorHandler();
  const [members, setMembers] = useState<readonly OrganizationMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadMembers() {
      try {
        const result = await getOrganizationMembers(organizationId);
        if (!isCancelled) {
          setMembers(result.members);
        }
      } catch (error) {
        if (!isCancelled) {
          handleApiError(error);
        }
      } finally {
        if (!isCancelled) {
          setIsMembersLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      isCancelled = true;
    };
  }, [organizationId, handleApiError]);

  const form = useValidatedForm<CreateTicketFormInput>({
    schema: createTicketFormSchema,
    defaultValues: {
      title: "",
      description: null,
      priority: "medium",
      assigneeId: null,
    },
    onSubmit: async (values) => {
      await createTicket(organizationId, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        assigneeId: values.assigneeId,
      });

      // TODO: チケット詳細画面実装後に詳細ルートへ遷移させる
      void navigate({
        to: `/app/${encodeURIComponent(organizationId)}/tickets`,
      });
    },
  });

  const assigneeOptions = useMemo(
    () => [
      { value: UNASSIGNED_VALUE, label: "未割当" },
      ...members.map((member) => ({
        value: member.userId,
        label: member.name ?? member.email,
      })),
    ],
    [members],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">チケットを作成</CardTitle>
          <CardDescription>
            新しいチケットの情報を入力してください
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
              name="title"
              children={(field) => (
                <TextField
                  id="ticket-title"
                  name="title"
                  label="タイトル"
                  placeholder="チケットのタイトルを入力"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  error={field.state.meta.errors.join(", ")}
                  disabled={form.state.isSubmitting}
                />
              )}
            />
            <form.Field
              name="description"
              children={(field) => (
                <TextareaField
                  id="ticket-description"
                  name="description"
                  label="説明"
                  placeholder="チケットの詳細を入力"
                  value={field.state.value ?? ""}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value === "" ? null : event.target.value,
                    )
                  }
                  error={field.state.meta.errors.join(", ")}
                  disabled={form.state.isSubmitting}
                />
              )}
            />
            <form.Field
              name="priority"
              children={(field) => (
                <SelectField
                  id="ticket-priority"
                  label="優先度"
                  options={priorityOptions}
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(value as TicketPriority)
                  }
                  error={field.state.meta.errors.join(", ")}
                  disabled={form.state.isSubmitting}
                />
              )}
            />
            <form.Field
              name="assigneeId"
              children={(field) => (
                <SelectField
                  id="ticket-assignee"
                  label="担当者"
                  placeholder={
                    isMembersLoading ? "メンバーを読み込み中…" : "未割当"
                  }
                  options={assigneeOptions}
                  value={field.state.value ?? UNASSIGNED_VALUE}
                  onValueChange={(value) =>
                    field.handleChange(
                      value === UNASSIGNED_VALUE ? null : value,
                    )
                  }
                  error={field.state.meta.errors.join(", ")}
                  disabled={form.state.isSubmitting || isMembersLoading}
                  loading={isMembersLoading}
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
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={form.state.isSubmitting}
                onClick={() =>
                  navigate({
                    to: `/app/${encodeURIComponent(organizationId)}/tickets`,
                  })
                }
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={form.state.isSubmitting}>
                {form.state.isSubmitting ? "作成中…" : "作成"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
