"use client";

import type { BatchEvent, BatchPage, BatchSummary } from "@datapulse/contracts";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { applyBatchEvent, isNewer, isStateChange } from "@/features/batches/realtime-patch";
import { qk } from "@/lib/api/query-keys";
import { createSseClient, type ConnectionState } from "@/lib/realtime/sse-client";

const RealtimeContext = createContext<ConnectionState>("closed");

/**
 * Um EventSource por aba (§3.1, ADR 10), com todos os lotes do tenant. Cada evento
 * atualiza o cache do TanStack Query; as telas não sabem que o SSE existe.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConnectionState>("connecting");
  const lastApplied = useRef(new Map<string, string>());

  useEffect(() => {
    const applied = lastApplied.current;

    const onEvent = (event: BatchEvent) => {
      const detailKey = qk.batches.detail(event.batch_id);
      const detail = queryClient.getQueryData<BatchSummary>(detailKey);
      if (!isNewer(event, applied.get(event.batch_id), detail?.as_of)) return;
      applied.set(event.batch_id, event.occurred_at);

      if (detail) queryClient.setQueryData(detailKey, applyBatchEvent(detail, event));

      queryClient.setQueriesData<InfiniteData<BatchPage>>({ queryKey: qk.batches.lists() }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((b) => (b.batch_id === event.batch_id ? applyBatchEvent(b, event) : b)),
              })),
            }
          : data,
      );

      if (isStateChange(event)) {
        // O detalhe completo (error_counts, date_range) e os filtros do histórico só a
        // API sabe recalcular.
        void queryClient.invalidateQueries({ queryKey: detailKey });
        void queryClient.invalidateQueries({ queryKey: qk.batches.lists() });
      }
      if (event.type === "batch.completed" || event.type === "batch.deleted") {
        void queryClient.invalidateQueries({ queryKey: qk.analytics.all });
      }
    };

    const client = createSseClient({
      onEvent,
      onResync: () => {
        applied.clear();
        void queryClient.invalidateQueries({ queryKey: qk.batches.all });
      },
      onStateChange: setState,
    });
    client.start();
    return () => client.stop();
  }, [queryClient]);

  return <RealtimeContext value={state}>{children}</RealtimeContext>;
}

export function useRealtimeState(): ConnectionState {
  return use(RealtimeContext);
}
