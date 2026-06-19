export type Pagination = {
  take?: number;
  skip?: number;
};

export const DEFAULT_TAKE = 100;
export const MAX_TAKE = 1000;
export const MAX_SKIP = 10000;

function normalizeInteger(
  value: number | undefined,
  defaultValue: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.trunc(value);
}

export function resolveTake(inputTake: number | undefined): number {
  const requested = normalizeInteger(inputTake, DEFAULT_TAKE);
  return Math.min(Math.max(requested, 1), MAX_TAKE);
}

export function resolveSkip(inputSkip: number | undefined): number {
  const requested = normalizeInteger(inputSkip, 0);
  return Math.min(Math.max(requested, 0), MAX_SKIP);
}
