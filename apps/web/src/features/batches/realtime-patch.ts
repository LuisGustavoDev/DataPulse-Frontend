import type { BatchEvent, BatchSummary } from "@datapulse/contracts";

// Um evento carrega estado, não incremento (§9.3): aplicar o mesmo evento duas vezes dá
// o mesmo resultado, e um evento mais antigo que o snapshot é descartado.

/** true se o evento é mais novo que o que o cache já mostra. */
export function isNewer(event: BatchEvent, lastApplied: string | undefined, snapshotAsOf?: string): boolean {
  const reference = [lastApplied, snapshotAsOf].filter(Boolean).sort().at(-1);
  return reference === undefined || Date.parse(event.occurred_at) >= Date.parse(reference);
}

export function applyBatchEvent<T extends BatchSummary>(batch: T, event: BatchEvent): T {
  switch (event.type) {
    case "batch.queued":
      return { ...batch, status: "QUEUED", attempt: event.attempt, progress: { phase: "waiting", bytes_read: 0, percent: 0 } };
    case "batch.started":
      return { ...batch, status: "PROCESSING", attempt: event.data.attempt };
    case "batch.progress": {
      const { phase, bytes_read, percent, rows_valid, rows_invalid } = event.data;
      const total = rows_valid + rows_invalid;
      return {
        ...batch,
        status: phase === "consolidating" ? "CONSOLIDATING" : "PROCESSING",
        size_bytes: event.data.size_bytes,
        progress: { phase, bytes_read, percent },
        rows: { total, valid: rows_valid, invalid: rows_invalid, invalid_ratio: total ? rows_invalid / total : null },
      };
    }
    case "batch.retrying":
      return { ...batch, status: "QUEUED", attempt: event.data.attempt, status_reason: event.data.reason_code };
    case "batch.completed": {
      const { status, rows_total, rows_valid, rows_invalid, invalid_ratio } = event.data;
      return {
        ...batch,
        status,
        status_reason: null,
        finished_at: event.occurred_at,
        progress: { phase: "done", bytes_read: batch.size_bytes ?? batch.progress?.bytes_read ?? 0, percent: 100 },
        rows: { total: rows_total, valid: rows_valid, invalid: rows_invalid, invalid_ratio },
      };
    }
    case "batch.failed": {
      const { status, reason_code, rows_total, rows_invalid } = event.data;
      return {
        ...batch,
        status,
        status_reason: reason_code,
        finished_at: event.occurred_at,
        rows: {
          total: rows_total,
          valid: rows_total - rows_invalid,
          invalid: rows_invalid,
          invalid_ratio: rows_total ? rows_invalid / rows_total : null,
        },
      };
    }
    case "batch.deleted":
      return { ...batch, status: "DELETED" };
  }
}

/** Eventos que mudam o que o histórico, o detalhe completo ou o dashboard mostram. */
export const isStateChange = (event: BatchEvent) => event.type !== "batch.progress";
