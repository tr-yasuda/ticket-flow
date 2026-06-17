export function isMswEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === "true";
}
