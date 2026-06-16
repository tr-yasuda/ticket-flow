import { Badge } from "@/components/ui/badge";
import { getRoleConfig } from "@/lib/badge-mapping";

type RoleBadgeProps = {
  role: string;
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const { label, variant } = getRoleConfig(role);

  return <Badge variant={variant}>{label}</Badge>;
}
