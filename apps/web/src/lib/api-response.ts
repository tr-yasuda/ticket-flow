export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractData<T>(
  body: unknown,
  isData: (data: unknown) => data is T,
): T {
  const data =
    isRecord(body) && body.success === true && isRecord(body.data)
      ? body.data
      : body;
  if (!isData(data)) {
    throw new Error("Invalid response");
  }
  return data;
}
