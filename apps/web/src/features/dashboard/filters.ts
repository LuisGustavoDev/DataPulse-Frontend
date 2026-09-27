"use client";

import {
  Granularity,
  MAX_ANALYTICS_WINDOW_DAYS,
  MAX_DRILLDOWN_WINDOW_DAYS,
  TxStatus,
  type AnalyticsFilters,
} from "@datapulse/contracts";
import { useMemo } from "react";
import { daysBetweenInclusive } from "@/lib/format";
import { useUrlParams } from "@/lib/url-state";

export type DashboardState = {
  filters: AnalyticsFilters;
  granularity: Granularity;
  metric: "amount" | "count";
  topOrder: "amount" | "count";
  /** Filtros extras do drill-down de transações. */
  clientId?: string;
  productId?: string;
  /** Mensagem quando from/to é inválido; as consultas ficam desligadas. */
  rangeError: string | null;
  /** O drill-down exige lote ou janela de até 31 dias. */
  drilldownAllowed: boolean;
};

/** Filtros do dashboard lidos da query string (§3.1). */
export function useDashboardState(batchId?: string): DashboardState & { set: ReturnType<typeof useUrlParams>["set"] } {
  const { get, set } = useUrlParams();
  const from = get("from");
  const to = get("to");
  const statusParam = get("status");
  const granularityParam = get("granularity");
  const metric = get("metric") === "count" ? "count" : "amount";
  const topOrder = get("top") === "count" ? "count" : "amount";
  const clientId = get("client");
  const productId = get("product");

  return useMemo(() => {
    const status = (statusParam?.split(",") ?? []).filter((s): s is TxStatus => TxStatus.safeParse(s).success);
    const granularity = Granularity.safeParse(granularityParam).data ?? (batchId ? "day" : "month");

    let rangeError: string | null = null;
    if (from && to && from > to) rangeError = "A data inicial é depois da final.";
    else if (from && to && daysBetweenInclusive(from, to) > MAX_ANALYTICS_WINDOW_DAYS) {
      rangeError = `O período máximo é de ${MAX_ANALYTICS_WINDOW_DAYS} dias.`;
    }

    const drilldownAllowed =
      Boolean(batchId) || Boolean(from && to && daysBetweenInclusive(from, to) <= MAX_DRILLDOWN_WINDOW_DAYS);

    return {
      filters: { batch_id: batchId, from, to, status: status.length ? status : undefined },
      granularity,
      metric,
      topOrder,
      clientId,
      productId,
      rangeError,
      drilldownAllowed,
      set,
    };
  }, [batchId, from, to, statusParam, granularityParam, metric, topOrder, clientId, productId, set]);
}
