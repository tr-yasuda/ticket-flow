export function parsePort(raw: string | undefined): number {
  const value = raw?.trim() === "" ? undefined : raw;
  const port = Number(value ?? "3000");
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}
