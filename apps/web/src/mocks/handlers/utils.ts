export function normalizePathParam(
  value: string | readonly string[] | undefined,
): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return value[0] ?? "";
}
