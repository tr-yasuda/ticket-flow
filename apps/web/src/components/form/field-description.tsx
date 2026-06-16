type FieldDescriptionProps = {
  fieldId: string;
  helperText?: string;
  error?: string;
  loading?: boolean;
};

function useFieldDescription(
  fieldId: string,
  helperText: string | undefined,
  error: string | undefined,
  loading: boolean | undefined,
) {
  const hasDescription = Boolean(helperText || loading);
  const descriptionId = hasDescription ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const ariaDescribedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return { descriptionId, errorId, ariaDescribedBy };
}

function FieldDescription({
  fieldId,
  helperText,
  error,
  loading,
}: FieldDescriptionProps) {
  const { descriptionId, errorId } = useFieldDescription(
    fieldId,
    helperText,
    error,
    loading,
  );

  return (
    <>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && (loading || helperText) && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {loading ? "送信中..." : helperText}
        </p>
      )}
    </>
  );
}

export { FieldDescription, useFieldDescription };
export type { FieldDescriptionProps };
