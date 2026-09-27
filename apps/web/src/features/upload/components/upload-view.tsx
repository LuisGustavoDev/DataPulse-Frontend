"use client";

import { REQUIRED_COLUMNS } from "@datapulse/csv-rules";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { batchesApi } from "@/features/batches/api";
import { useAuthenticatedSession } from "@/providers/session-provider";
import { resumeStore, type PendingUpload } from "../resume-store";
import { useUpload } from "../use-upload";
import { Dropzone } from "./dropzone";
import { PendingUploads } from "./pending-uploads";
import { UploadStatus } from "./upload-status";

export function UploadView() {
  const { user } = useAuthenticatedSession();
  const { state, start, cancel, reset } = useUpload();
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const refreshPending = useCallback(() => {
    void resumeStore.list(user.id).then(setPending);
  }, [user.id]);

  // Recarrega ao abrir e sempre que um envio termina, falha ou é cancelado.
  useEffect(refreshPending, [refreshPending, state.phase]);

  const discard = async (upload: PendingUpload) => {
    await resumeStore.remove(upload.batchId);
    await batchesApi.abort(upload.batchId).catch(() => undefined);
    refreshPending();
  };

  const file = state.phase !== "idle" && state.phase !== "done" ? state.file : null;
  const idle = state.phase === "idle";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Novo upload" description="O arquivo vai direto para o armazenamento, em partes, e pode ser retomado se a conexão cair." />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {idle ? <Dropzone onFile={(f) => void start(f)} /> : (
            <UploadStatus
              state={state}
              onRetry={(opts) => file && void start(file, opts)}
              onCancel={() => void cancel()}
              onReset={reset}
            />
          )}
          {idle && <PendingUploads uploads={pending} onDiscard={(u) => void discard(u)} />}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Formato esperado" />
            <p className="text-sm text-muted">Exatamente estas colunas, em qualquer ordem:</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {REQUIRED_COLUMNS.map((c) => (
                <li key={c} className="rounded bg-surface-2 px-2 py-0.5 font-mono text-xs">
                  {c}
                </li>
              ))}
            </ul>
            <ul className="mt-4 list-disc space-y-1 pl-4 text-sm text-muted">
              <li>Separador vírgula ou ponto e vírgula; UTF-8 ou Windows-1252 (exportação do Excel funciona).</li>
              <li>Datas em AAAA-MM-DD ou DD/MM/AAAA.</li>
              <li>Valor com ponto ou vírgula decimal, sem separador de milhar.</li>
              <li>Status: aprovada, pendente, cancelada ou estornada.</li>
              <li>Até 5% de linhas inválidas são toleradas; acima disso o lote é reprovado.</li>
            </ul>
          </Card>
          {/* §11.4: cliente_id pode ser dado pessoal. */}
          <Alert tone="warning" title="Proteção de dados">
            Não use CPF ou outro documento pessoal como <span className="font-mono">cliente_id</span>. Prefira um código interno.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
