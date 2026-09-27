import type { AnalyticsFilters, BatchListFilters } from "@datapulse/contracts";

// Chaves do TanStack Query num lugar só: o SSE e as mutações invalidam por prefixo.
export const qk = {
  batches: {
    all: ["batches"] as const,
    lists: () => ["batches", "list"] as const,
    list: (filters: BatchListFilters) => ["batches", "list", filters] as const,
    details: () => ["batches", "detail"] as const,
    detail: (id: string) => ["batches", "detail", id] as const,
    anomalies: (id: string, errorCode?: string) => ["batches", "anomalies", id, errorCode ?? null] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    part: (part: string, filters: AnalyticsFilters, extra?: Record<string, unknown>) =>
      ["analytics", part, filters, extra ?? {}] as const,
  },
  users: {
    all: ["users"] as const,
  },
};
