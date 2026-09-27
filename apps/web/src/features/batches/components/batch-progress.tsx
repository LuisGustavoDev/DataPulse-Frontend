import type { BatchSummary } from "@datapulse/contracts";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatBytes, formatInt } from "@/lib/format";

/**
 * Parsing vai de 0 a 95%; na consolidação a barra fica indeterminada com
 * "Consolidando…" (§9.3). Fora dessas fases não há barra.
 */
export function BatchProgress({ batch, compact = false }: { batch: BatchSummary; compact?: boolean }) {
  const { status, progress, rows } = batch;
  if (status !== "QUEUED" && status !== "PROCESSING" && status !== "CONSOLIDATING") return null;

  const consolidating = status === "CONSOLIDATING";
  const percent = status === "QUEUED" ? 0 : (progress?.percent ?? 0);
  const label = consolidating ? "Consolidando…" : status === "QUEUED" ? "Na fila" : `Processando ${Math.floor(percent)}%`;

  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <ProgressBar label={`Progresso do lote ${batch.filename}`} value={consolidating ? null : percent} />
      <p className="text-xs text-muted">
        {label}
        {!compact && progress && batch.size_bytes && !consolidating
          ? ` · ${formatBytes(progress.bytes_read)} de ${formatBytes(batch.size_bytes)}`
          : null}
        {!compact && rows ? ` · ${formatInt(rows.valid)} válidas, ${formatInt(rows.invalid)} inválidas` : null}
      </p>
    </div>
  );
}
