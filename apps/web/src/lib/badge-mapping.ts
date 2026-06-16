import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<
  VariantProps<typeof import("@/components/ui/badge").badgeVariants>["variant"]
>;

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type Role = "owner" | "admin" | "member" | "viewer";

type BadgeConfig = {
  label: string;
  variant: BadgeVariant;
};

const ticketStatusConfig: Record<TicketStatus, BadgeConfig> = {
  open: { label: "未対応", variant: "default" },
  in_progress: { label: "対応中", variant: "secondary" },
  resolved: { label: "解決済み", variant: "outline" },
  closed: { label: "完了", variant: "ghost" },
};

const ticketPriorityConfig: Record<TicketPriority, BadgeConfig> = {
  low: { label: "低", variant: "outline" },
  medium: { label: "中", variant: "secondary" },
  high: { label: "高", variant: "default" },
  urgent: { label: "緊急", variant: "destructive" },
};

const roleConfig: Record<Role, BadgeConfig> = {
  owner: { label: "オーナー", variant: "default" },
  admin: { label: "管理者", variant: "secondary" },
  member: { label: "メンバー", variant: "outline" },
  viewer: { label: "閲覧者", variant: "ghost" },
};

const fallbackConfig: BadgeConfig = {
  label: "不明",
  variant: "outline",
};

function getConfig<TKey extends string>(
  config: Record<TKey, BadgeConfig>,
  key: string,
): BadgeConfig {
  if (!Object.prototype.hasOwnProperty.call(config, key)) {
    return fallbackConfig;
  }

  return config[key as TKey];
}

export function getTicketStatusConfig(status: string): BadgeConfig {
  return getConfig(ticketStatusConfig, status);
}

export function getTicketPriorityConfig(priority: string): BadgeConfig {
  return getConfig(ticketPriorityConfig, priority);
}

export function getRoleConfig(role: string): BadgeConfig {
  return getConfig(roleConfig, role);
}
