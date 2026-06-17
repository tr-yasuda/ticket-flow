import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InlineErrorProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function InlineError({
  message,
  onRetry,
  className,
}: InlineErrorProps) {
  return (
    <Alert
      data-testid="inline-error"
      variant="destructive"
      className={cn(className)}
    >
      <AlertCircle className="size-4" />
      <AlertTitle>エラー</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{message}</span>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
          >
            再試行
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
