import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";

import {
  FieldDescription,
  useFieldDescription,
} from "@/components/form/field-description";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type" | "id"> & {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
  loading?: boolean;
};

function PasswordField({
  id,
  label,
  helperText,
  error,
  disabled,
  loading,
  className,
  ...props
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const { ariaDescribedBy } = useFieldDescription(
    id,
    helperText,
    error,
    loading,
  );
  const isDisabled = disabled || loading;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={isVisible ? "text" : "password"}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={ariaDescribedBy}
          disabled={isDisabled}
          className="pr-10"
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          aria-label={isVisible ? "パスワードを隠す" : "パスワードを表示"}
          disabled={isDisabled}
          onClick={() => setIsVisible((prev) => !prev)}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      <FieldDescription
        fieldId={id}
        helperText={helperText}
        error={error}
        loading={loading}
      />
    </div>
  );
}

export { PasswordField };
export type { PasswordFieldProps };
