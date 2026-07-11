import {
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTitleSchema,
  type TicketPriority,
  type TicketStatus,
} from "@ticket-flow/shared";
import { useMemo, type ReactElement } from "react";
import { z } from "zod";

import { FormError } from "@/components/form/form-error";
import { SelectField, type SelectOption } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
import { Button } from "@/components/ui/button";
import { useValidatedForm } from "@/hooks/use-validated-form";
import {
  getTicketPriorityConfig,
  getTicketStatusConfig,
} from "@/lib/badge-mapping";

const UNASSIGNED_VALUE = "__UNASSIGNED__";
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 10000;

function trim(value: string): string {
  return value.trim();
}

const ticketCreateFormSchema = z.object({
  title: ticketTitleSchema,
  description: z
    .string()
    .transform(trim)
    .refine(
      (value) => value.length <= DESCRIPTION_MAX_LENGTH,
      `説明は${DESCRIPTION_MAX_LENGTH}文字以内で入力してください`,
    )
    .optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assigneeId: z
    .string()
    .uuid({ message: "担当者IDの形式が正しくありません" })
    .nullable()
    .optional(),
});

type TicketCreateFormValues = z.input<typeof ticketCreateFormSchema>;

export type { TicketCreateFormValues };

export type TicketCreateFormProps = {
  assigneeOptions: SelectOption[];
  onSubmit: (values: {
    title: string;
    description: string | null;
    status?: TicketStatus;
    priority?: TicketPriority;
    assigneeId: string | null;
  }) => Promise<void>;
};

const statusOptions: SelectOption[] = (
  ["open", "in-progress", "closed"] as const satisfies readonly TicketStatus[]
).map((status) => ({
  value: status,
  label: getTicketStatusConfig(status).label,
}));

const priorityOptions: SelectOption[] = (
  [
    "low",
    "medium",
    "high",
    "urgent",
  ] as const satisfies readonly TicketPriority[]
).map((priority) => ({
  value: priority,
  label: getTicketPriorityConfig(priority).label,
}));

const unassignedOption: SelectOption = {
  value: UNASSIGNED_VALUE,
  label: "未割当",
};

function formatFieldErrors(errors: ReadonlyArray<string | undefined>): string {
  return [
    ...new Set(errors.filter((e): e is string => typeof e === "string")),
  ].join(", ");
}

function normalizeDescription(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function TicketCreateForm({
  assigneeOptions,
  onSubmit,
}: TicketCreateFormProps): ReactElement {
  const form = useValidatedForm({
    schema: ticketCreateFormSchema,
    defaultValues: {
      title: "",
      description: "",
      status: undefined,
      priority: undefined,
      assigneeId: undefined,
    },
    resetOnSuccess: true,
    onSubmit: async (values: TicketCreateFormValues) => {
      await onSubmit({
        title: values.title.trim(),
        description: normalizeDescription(values.description),
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId ?? null,
      });
    },
  });

  const assigneeSelectOptions = useMemo(
    () => [unassignedOption, ...assigneeOptions],
    [assigneeOptions],
  );

  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
      className="grid gap-4"
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field
              name="title"
              children={(field) => (
                <TextField
                  id="title"
                  name="title"
                  label="タイトル"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  error={formatFieldErrors(field.state.meta.errors)}
                  disabled={isSubmitting}
                  maxLength={TITLE_MAX_LENGTH}
                />
              )}
            />
            <form.Field
              name="description"
              children={(field) => (
                <TextareaField
                  id="description"
                  name="description"
                  label="説明"
                  value={field.state.value ?? ""}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  error={formatFieldErrors(field.state.meta.errors)}
                  disabled={isSubmitting}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                />
              )}
            />
            <form.Field
              name="status"
              children={(field) => (
                <SelectField
                  id="status"
                  name="status"
                  label="ステータス"
                  placeholder="ステータスを選択"
                  options={statusOptions}
                  value={field.state.value ?? ""}
                  onValueChange={(value) => {
                    if (value === "") {
                      field.handleChange(undefined);
                      return;
                    }
                    const parsed = ticketStatusSchema.safeParse(value);
                    if (parsed.success) {
                      field.handleChange(parsed.data);
                    }
                  }}
                  onOpenChange={(open) => {
                    if (!open) {
                      field.handleBlur();
                    }
                  }}
                  error={formatFieldErrors(field.state.meta.errors)}
                  disabled={isSubmitting}
                />
              )}
            />
            <form.Field
              name="priority"
              children={(field) => (
                <SelectField
                  id="priority"
                  name="priority"
                  label="優先度"
                  placeholder="優先度を選択"
                  options={priorityOptions}
                  value={field.state.value ?? ""}
                  onValueChange={(value) => {
                    if (value === "") {
                      field.handleChange(undefined);
                      return;
                    }
                    const parsed = ticketPrioritySchema.safeParse(value);
                    if (parsed.success) {
                      field.handleChange(parsed.data);
                    }
                  }}
                  onOpenChange={(open) => {
                    if (!open) {
                      field.handleBlur();
                    }
                  }}
                  error={formatFieldErrors(field.state.meta.errors)}
                  disabled={isSubmitting}
                />
              )}
            />
            <form.Field
              name="assigneeId"
              children={(field) => (
                <SelectField
                  id="assigneeId"
                  name="assigneeId"
                  label="担当者"
                  placeholder="担当者を選択"
                  options={assigneeSelectOptions}
                  value={
                    field.state.value === null
                      ? UNASSIGNED_VALUE
                      : (field.state.value ?? "")
                  }
                  onValueChange={(value) => {
                    if (value === UNASSIGNED_VALUE || value === "") {
                      field.handleChange(null);
                      return;
                    }
                    field.handleChange(value);
                  }}
                  onOpenChange={(open) => {
                    if (!open) {
                      field.handleBlur();
                    }
                  }}
                  error={formatFieldErrors(field.state.meta.errors)}
                  disabled={isSubmitting}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "作成中..." : "作成"}
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
