import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type LoadingSpinnerProps = {
  message?: string;
  className?: string;
};

export function LoadingSpinner({ message, className }: LoadingSpinnerProps) {
  return (
    <div
      data-testid="loading-spinner"
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        className,
      )}
    >
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
