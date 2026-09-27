"use client";

import type { AnalyticsFilters, Granularity } from "@datapulse/contracts";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/api/query-keys";
import { analyticsApi } from "./api";

// Dashboards leem rollups (ADR 11); mudar filtro mantém o gráfico anterior na tela até
// o novo chegar, em vez de piscar vazio.

export function useSummary(f: AnalyticsFilters, enabled: boolean) {
  return useQuery({
    queryKey: qk.analytics.part("summary", f),
    queryFn: ({ signal }) => analyticsApi.summary(f, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useTimeseries(f: AnalyticsFilters, granularity: Granularity, enabled: boolean) {
  return useQuery({
    queryKey: qk.analytics.part("timeseries", f, { granularity }),
    queryFn: ({ signal }) => analyticsApi.timeseries(f, granularity, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useStatusBreakdown(f: AnalyticsFilters, enabled: boolean) {
  return useQuery({
    queryKey: qk.analytics.part("status", f),
    queryFn: ({ signal }) => analyticsApi.statusBreakdown(f, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useTopProducts(f: AnalyticsFilters, orderBy: "amount" | "count", enabled: boolean) {
  return useQuery({
    queryKey: qk.analytics.part("top-products", f, { orderBy }),
    queryFn: ({ signal }) => analyticsApi.topProducts(f, orderBy, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useTopClients(batchId: string | undefined) {
  return useQuery({
    queryKey: qk.analytics.part("top-clients", { batch_id: batchId }),
    queryFn: ({ signal }) => analyticsApi.topClients(batchId as string, signal),
    enabled: Boolean(batchId),
  });
}

export function useTransactions(
  f: AnalyticsFilters & { client_id?: string; product_id?: string },
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: qk.analytics.part("transactions", f),
    queryFn: ({ pageParam, signal }) => analyticsApi.transactions(f, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
  });
}
