export function generateSlug(name: string): string {
  const normalized = name.trim().toLowerCase().normalize("NFKD");
  const base = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200)
    .replace(/^-|-$/g, "");
  return base || `org-${crypto.randomUUID().split("-")[0]}`;
}
