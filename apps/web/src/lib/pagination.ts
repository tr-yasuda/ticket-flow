export const MIN_PAGE = 1;
export const MAX_PAGE = 10000;
export const MIN_PER_PAGE = 1;
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

export function normalizePage(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_PAGE;
  }
  return Math.min(MAX_PAGE, Math.max(MIN_PAGE, Math.floor(value)));
}

export function normalizePerPage(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PER_PAGE;
  }
  return Math.min(MAX_PER_PAGE, Math.max(MIN_PER_PAGE, Math.floor(value)));
}
