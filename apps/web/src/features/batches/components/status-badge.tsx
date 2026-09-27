import type { BatchStatus } from "@datapulse/contracts";
import { Badge } from "@/components/ui/badge";
import { BATCH_STATUS } from "../labels";

export function StatusBadge({ status }: { status: BatchStatus }) {
  const { label, tone, description } = BATCH_STATUS[status];
  return (
    <span title={description}>
      <Badge tone={tone}>{label}</Badge>
    </span>
  );
}
