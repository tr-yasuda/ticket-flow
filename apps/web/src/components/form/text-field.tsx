import * as React from "react";

import {
  FieldDescription,
  useFieldDescription,
} from "@/components/form/field-description";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TextFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
  loading?: boolean;
};

function TextField({
  id,
  label,
  helperText,
  error,
  disabled,
  loading,
  className,
  ...props
}: TextFieldProps) {
  const { ariaDescribedBy } = useFieldDescription(
    id,
    helperText,
    error,
    loading,
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
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

export { TextField };
export type { TextFieldProps };
