import { Badge } from "@/components/ui/badge";
import { getTicketPriorityConfig } from "@/lib/badge-mapping";

type TicketPriorityBadgeProps = {
  priority: string;
};

export function TicketPriorityBadge({ priority }: TicketPriorityBadgeProps) {
  const { label, variant } = getTicketPriorityConfig(priority);

  return <Badge variant={variant}>{label}</Badge>;
}
