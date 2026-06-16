import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type FormErrorProps = Omit<React.ComponentProps<typeof Alert>, "variant"> & {
  message: string;
};

function FormError({ message, className, ...props }: FormErrorProps) {
  return (
    <Alert variant="destructive" className={cn("w-full", className)} {...props}>
      <AlertTitle>エラー</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export { FormError };
export type { FormErrorProps };
