"use client";

import type { BatchDetail } from "@datapulse/contracts";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatInt } from "@/lib/format";
import { useAnomalies, useExportAnomalies } from "../hooks";
import { rowErrorLabel } from "../labels";

/** §8.4: até 50.000 anomalias paginadas por line_number; o CSV completo vai pela exportação. */
export function AnomaliesCard({ batch }: { batch: BatchDetail }) {
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const query = useAnomalies(batch.batch_id, errorCode, true);
  const exporter = useExportAnomalies(batch.batch_id);

  const first = query.data?.pages[0];
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const expired = isApiError(query.error, "ANOMALIES_EXPIRED") || isApiError(exporter.error, "ANOMALIES_EXPIRED");

  return (
    <Card>
      <CardHeader
        title="Anomalias"
        description="Cada linha inválida, com o primeiro erro encontrado. Corrija o arquivo e envie de novo."
        actions={
          <Button variant="secondary" size="sm" loading={exporter.isPending} disabled={expired} onClick={() => exporter.mutate()}>
            Exportar CSV completo
          </Button>
        }
      />

      {batch.error_counts.length > 0 && (
        <ul className="mb-5 flex flex-wrap gap-2" aria-label="Erros por tipo">
          {batch.error_counts.map((e) => (
            <li key={e.code}>
              <button
                type="button"
                aria-pressed={errorCode === e.code}
                onClick={() => setErrorCode(errorCode === e.code ? undefined : e.code)}
                className="rounded-md border border-border px-3 py-1.5 text-left text-xs hover:bg-surface-2 aria-pressed:border-primary aria-pressed:bg-info-bg"
              >
                <span className="font-medium">{rowErrorLabel(e.code)}</span>
                <span className="ml-2 tabular-nums text-muted">{formatInt(e.count)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {exporter.isError && !expired && <Alert tone="danger" className="mb-4">{errorMessage(exporter.error)}</Alert>}

      {expired ? (
        <Alert tone="warning" title="Anomalias expiradas">
          As anomalias ficam disponíveis por 30 dias após o processamento e já foram apagadas.
        </Alert>
      ) : query.isPending ? (
        <Spinner label="Carregando anomalias…" />
      ) : query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma anomalia{errorCode ? " deste tipo" : ""}.</p>
      ) : (
        <>
          {first?.truncated && (
            <Alert tone="info" className="mb-4">
              Mostrando as primeiras {formatInt(first.stored)} de {formatInt(first.total)} anomalias. A exportação traz todas.
            </Alert>
          )}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Linhas inválidas do arquivo</caption>
              <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Linha</th>
                  <th scope="col" className="px-3 py-2 font-medium">Erro</th>
                  <th scope="col" className="px-3 py-2 font-medium">Coluna</th>
                  <th scope="col" className="px-3 py-2 font-medium">Mensagem</th>
                  <th scope="col" className="px-3 py-2 font-medium">Conteúdo original</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((a) => (
                  <tr key={a.line_number}>
                    <td className="px-3 py-2 text-right tabular-nums">{formatInt(a.line_number)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{rowErrorLabel(a.error_code)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.column ?? "—"}</td>
                    <td className="px-3 py-2">{a.message}</td>
                    <td className="max-w-80 truncate px-3 py-2 font-mono text-xs text-muted" title={a.raw_line ?? undefined}>
                      {a.raw_line ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.hasNextPage && (
            <div className="mt-3 text-center">
              <Button variant="secondary" size="sm" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
