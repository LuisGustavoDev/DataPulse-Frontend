"use client";

import { hasAnalytics, hasAnomalies, isTerminal, type BatchDetail } from "@datapulse/contracts";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { FullPageSpinner } from "@/components/ui/spinner";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatBytes, formatDate, formatDateTime, formatInt, formatPercent } from "@/lib/format";
import { useBatch } from "../hooks";
import { BATCH_STATUS, reasonLabel } from "../labels";
import { AnomaliesCard } from "./anomalies-card";
import { BatchActions } from "./batch-actions";
import { BatchProgress } from "./batch-progress";
import { StatusBadge } from "./status-badge";

export function BatchDetailView({ id }: { id: string }) {
  const query = useBatch(id);

  if (query.isPending) return <FullPageSpinner label="Carregando lote…" />;

  if (query.isError) {
    // 404 também para lote de outro tenant (§8.3): não revela que existe.
    if (isApiError(query.error) && query.error.status === 404) {
      return (
        <Alert tone="warning" title="Lote não encontrado">
          O lote não existe ou não pertence à sua empresa.{" "}
          <Link href="/batches" className="font-medium underline">
            Voltar para os lotes
          </Link>
        </Alert>
      );
    }
    return (
      <Alert tone="danger" title="Não foi possível carregar o lote" actions={<Button variant="secondary" size="sm" onClick={() => query.refetch()}>Tentar de novo</Button>}>
        {errorMessage(query.error)}
      </Alert>
    );
  }

  const batch = query.data;
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Trilha" className="text-sm text-muted">
        <Link href="/batches" className="hover:text-fg hover:underline">
          Lotes
        </Link>{" "}
        / <span className="text-fg">{batch.filename}</span>
      </nav>

      <PageHeader
        title={batch.filename}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={batch.status} />
            <span>
              Enviado em {formatDateTime(batch.created_at)}
              {batch.created_by && ` por ${batch.created_by.email}`}
            </span>
          </span>
        }
        actions={<BatchActions batch={batch} />}
      />

      <StatusPanel batch={batch} />
      <Facts batch={batch} />
      {hasAnomalies(batch.status) && <AnomaliesCard batch={batch} />}

      {hasAnalytics(batch.status) && (
        <section aria-labelledby="dashboard-lote" className="flex flex-col gap-4">
          <h2 id="dashboard-lote" className="text-lg font-semibold">
            Dashboard do lote
          </h2>
          <DashboardView batchId={batch.batch_id} />
        </section>
      )}
    </div>
  );
}

function StatusPanel({ batch }: { batch: BatchDetail }) {
  const info = BATCH_STATUS[batch.status];
  const reason = reasonLabel(batch.status_reason);
  const active = !isTerminal(batch.status);

  if (active) {
    return (
      <Card>
        {/* aria-live anuncia a mudança de fase sem roubar o foco (§3.1). */}
        <div aria-live="polite" className="mb-3 text-sm">
          <span className="font-medium">{info.label}.</span> <span className="text-muted">{info.description}</span>
          {batch.status === "QUEUED" && (batch.attempt ?? 0) > 0 && reason && (
            <span className="text-muted"> Nova tentativa agendada ({reason}).</span>
          )}
        </div>
        <BatchProgress batch={batch} />
      </Card>
    );
  }

  const tone = info.tone === "success" ? "success" : info.tone === "danger" ? "danger" : info.tone === "warning" ? "warning" : "info";
  return (
    <Alert tone={tone} title={info.label}>
      <span aria-live="polite">{reason ?? info.description}</span>
      {batch.status === "PARTIAL" && batch.rows && (
        <> {formatInt(batch.rows.invalid)} linhas inválidas ({formatPercent(batch.rows.invalid_ratio, 2)}) ficaram de fora; as demais foram importadas.</>
      )}
    </Alert>
  );
}

function Facts({ batch }: { batch: BatchDetail }) {
  const facts: Array<[string, string]> = [
    ["Linhas lidas", formatInt(batch.rows?.total)],
    ["Válidas", formatInt(batch.rows?.valid)],
    ["Inválidas", batch.rows ? `${formatInt(batch.rows.invalid)} (${formatPercent(batch.rows.invalid_ratio, 2)})` : "—"],
    ["Tamanho", formatBytes(batch.size_bytes)],
    ["Período dos dados", batch.date_range?.min ? `${formatDate(batch.date_range.min)} a ${formatDate(batch.date_range.max)}` : "—"],
    ["Fila", batch.queue === "heavy" ? "Pesada" : batch.queue === "express" ? "Expressa" : "—"],
    ["Tentativas", batch.attempt ? String(batch.attempt) : "—"],
    ["Iniciado", formatDateTime(batch.started_at)],
    ["Concluído", formatDateTime(batch.finished_at)],
    ["Arquivo original até", formatDateTime(batch.raw_file_available_until)],
  ];
  return (
    <Card>
      <CardHeader title="Resumo" />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
