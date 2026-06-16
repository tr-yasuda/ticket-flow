import * as React from "react";

import {
  FieldDescription,
  useFieldDescription,
} from "@/components/form/field-description";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TextareaFieldProps = Omit<React.ComponentProps<"textarea">, "id"> & {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
  loading?: boolean;
};

function TextareaField({
  id,
  label,
  helperText,
  error,
  disabled,
  loading,
  className,
  ...props
}: TextareaFieldProps) {
  const { ariaDescribedBy } = useFieldDescription(
    id,
    helperText,
    error,
    loading,
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={ariaDescribedBy}
        disabled={disabled || loading}
        {...props}
      />
      <FieldDescription
        fieldId={id}
        helperText={helperText}
        error={error}
        loading={loading}
      />
    </div>
  );
}

export { TextareaField };
export type { TextareaFieldProps };
