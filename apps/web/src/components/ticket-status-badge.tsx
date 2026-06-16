import { Badge } from "@/components/ui/badge";
import { getTicketStatusConfig } from "@/lib/badge-mapping";

type TicketStatusBadgeProps = {
  status: string;
};

export function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
  const { label, variant } = getTicketStatusConfig(status);

  return <Badge variant={variant}>{label}</Badge>;
}
