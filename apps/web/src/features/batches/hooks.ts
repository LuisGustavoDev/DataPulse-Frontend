"use client";

import { isTerminal, type BatchListFilters } from "@datapulse/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/api/query-keys";
import { useRealtimeState } from "@/providers/realtime-provider";
import { batchesApi } from "./api";

/** Sem SSE (reconectando), lotes ativos caem para polling até o tempo real voltar. */
const FALLBACK_POLL_MS = 5_000;

export function useBatchList(filters: BatchListFilters) {
  const realtime = useRealtimeState();
  return useInfiniteQuery({
    queryKey: qk.batches.list(filters),
    queryFn: ({ pageParam, signal }) => batchesApi.list(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: (query) => {
      if (realtime === "open") return false;
      const hasActive = query.state.data?.pages.some((p) => p.items.some((b) => !isTerminal(b.status)));
      return hasActive ? FALLBACK_POLL_MS : false;
    },
  });
}

export function useBatch(id: string) {
  const realtime = useRealtimeState();
  return useQuery({
    queryKey: qk.batches.detail(id),
    queryFn: ({ signal }) => batchesApi.get(id, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return realtime !== "open" && status && !isTerminal(status) ? FALLBACK_POLL_MS : false;
    },
  });
}

export function useAnomalies(id: string, errorCode: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: qk.batches.anomalies(id, errorCode),
    queryFn: ({ pageParam, signal }) => batchesApi.anomalies(id, errorCode, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
  });
}

export function useRetryBatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => batchesApi.retry(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.batches.all }),
  });
}

export function useDeleteBatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => batchesApi.remove(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.batches.all });
      void queryClient.invalidateQueries({ queryKey: qk.analytics.all });
    },
  });
}

export function useExportAnomalies(id: string) {
  return useMutation({
    mutationFn: () => batchesApi.exportAnomalies(id),
    // A URL assinada vale 15 min: navega na hora em vez de guardar.
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
}
