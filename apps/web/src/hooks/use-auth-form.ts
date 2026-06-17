import { useForm } from "@tanstack/react-form";
import type { ZodSchema } from "zod";

import { mapApiErrorToFields, mapZodErrorToFields } from "@/lib/validation";

type UseAuthFormOptions<TValues extends Record<string, unknown>> = Readonly<{
  schema: ZodSchema<TValues>;
  defaultValues: TValues;
  onSubmit: (values: TValues) => Promise<void>;
}>;

export function useAuthForm<TValues extends Record<string, unknown>>({
  schema,
  defaultValues,
  onSubmit,
}: UseAuthFormOptions<TValues>) {
  return useForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        if (result.success) {
          return undefined;
        }
        return { fields: mapZodErrorToFields(result.error) };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await onSubmit(value);
      } catch (error) {
        const fields = mapApiErrorToFields(error);
        if (Object.keys(fields).length === 0) {
          formApi.setErrorMap({ onSubmit: "処理に失敗しました" });
        } else {
          formApi.setErrorMap({ onSubmit: { fields } });
        }
      }
    },
  });
}
