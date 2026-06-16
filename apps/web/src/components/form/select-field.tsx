import * as React from "react";

import {
  FieldDescription,
  useFieldDescription,
} from "@/components/form/field-description";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = Omit<
  React.ComponentProps<typeof Select>,
  "className"
> & {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
  loading?: boolean;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
};

function SelectField({
  id,
  label,
  helperText,
  error,
  disabled,
  loading,
  options,
  placeholder,
  className,
  ...props
}: SelectFieldProps) {
  const { ariaDescribedBy } = useFieldDescription(
    id,
    helperText,
    error,
    loading,
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select disabled={disabled || loading} {...props}>
        <SelectTrigger
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={ariaDescribedBy}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription
        fieldId={id}
        helperText={helperText}
        error={error}
        loading={loading}
      />
    </div>
  );
}

export { SelectField };
export type { SelectFieldProps, SelectOption };
