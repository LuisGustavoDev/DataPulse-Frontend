import {
  StatusBreakdown,
  Summary,
  Timeseries,
  TopClients,
  TopProducts,
  TransactionPage,
  type AnalyticsFilters,
  type Granularity,
} from "@datapulse/contracts";
import { apiFetch } from "@/lib/api/client";

// §8.5 Analytics. Todos os endpoints aceitam batch_id, from, to e status.

const q = (f: AnalyticsFilters) => ({ batch_id: f.batch_id, from: f.from, to: f.to, status: f.status });

export const analyticsApi = {
  summary: (f: AnalyticsFilters, signal?: AbortSignal) =>
    apiFetch("/analytics/summary", { query: q(f), schema: Summary, signal }),

  timeseries: (f: AnalyticsFilters, granularity: Granularity, signal?: AbortSignal) =>
    apiFetch("/analytics/timeseries", { query: { ...q(f), granularity }, schema: Timeseries, signal }),

  statusBreakdown: (f: AnalyticsFilters, signal?: AbortSignal) =>
    apiFetch("/analytics/breakdown/status", { query: q(f), schema: StatusBreakdown, signal }),

  topProducts: (f: AnalyticsFilters, orderBy: "amount" | "count", signal?: AbortSignal) =>
    apiFetch("/analytics/top-products", { query: { ...q(f), order_by: orderBy, limit: 10 }, schema: TopProducts, signal }),

  /** Exige batch_id e ignora os outros filtros. */
  topClients: (batchId: string, signal?: AbortSignal) =>
    apiFetch("/analytics/top-clients", { query: { batch_id: batchId }, schema: TopClients, signal }),

  transactions: (
    f: AnalyticsFilters & { client_id?: string; product_id?: string },
    cursor: string | undefined,
    signal?: AbortSignal,
  ) =>
    apiFetch("/analytics/transactions", {
      query: { ...q(f), client_id: f.client_id, product_id: f.product_id, cursor, limit: 50 },
      schema: TransactionPage,
      signal,
    }),
};
