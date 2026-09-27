"use client";

import { SchemaMismatchErrors } from "@datapulse/contracts";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { errorMessage, isApiError, type ApiError } from "@/lib/api/errors";
import { formatBytes, formatPercent } from "@/lib/format";
import type { UploadState } from "../use-upload";

type Props = {
  state: Exclude<UploadState, { phase: "idle" }>;
  onRetry: (opts?: { allowDuplicate?: boolean; sha256?: string }) => void;
  onCancel: () => void;
  onReset: () => void;
};

export function UploadStatus({ state, onRetry, onCancel, onReset }: Props) {
  switch (state.phase) {
    case "inspecting":
      return <Step title="Conferindo o cabeçalho…" file={state.file} progress={null} />;

    case "hashing":
      return (
        <Step
          title="Calculando a assinatura do arquivo…"
          description="O SHA-256 detecta reenvios e permite retomar o upload."
          file={state.file}
          progress={(state.bytes / state.file.size) * 100}
          actions={<Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>}
        />
      );

    case "creating":
      return <Step title="Preparando o envio…" file={state.file} progress={null} />;

    case "uploading":
      return (
        <Step
          title={state.resumed ? "Retomando o envio…" : "Enviando…"}
          description={`${formatBytes(state.sent)} de ${formatBytes(state.file.size)} · ${formatPercent(state.sent / state.file.size, 0)}`}
          file={state.file}
          progress={(state.sent / state.file.size) * 100}
          actions={<Button variant="ghost" size="sm" onClick={onCancel}>Cancelar envio</Button>}
        />
      );

    case "completing":
      return <Step title="Validando o arquivo no servidor…" file={state.file} progress={null} />;

    case "done":
      return (
        <Alert
          tone="success"
          title="Arquivo recebido e na fila de processamento"
          actions={
            <>
              <ButtonLink href={`/batches/${state.batchId}`} size="sm">
                Acompanhar o processamento
              </ButtonLink>
              <Button variant="secondary" size="sm" onClick={onReset}>
                Enviar outro
              </Button>
            </>
          }
        >
          O progresso aparece em tempo real na página do lote.
        </Alert>
      );

    case "invalid":
      return (
        <Alert tone="danger" title={invalidTitle(state.reason.code)} actions={<Button variant="secondary" size="sm" onClick={onReset}>Escolher outro arquivo</Button>}>
          <p>
            <strong>{state.file.name}</strong>: {state.reason.detail}
          </p>
          {"missing" in state.reason && <MismatchList {...state.reason} />}
        </Alert>
      );

    case "duplicate":
      return (
        <Alert
          tone="warning"
          title="Este arquivo já foi importado"
          actions={
            <>
              {state.existingBatchId && (
                <ButtonLink href={`/batches/${state.existingBatchId}`} variant="secondary" size="sm">
                  Ver o lote existente
                </ButtonLink>
              )}
              <Button size="sm" onClick={() => onRetry({ allowDuplicate: true, sha256: state.sha256 })}>
                Importar mesmo assim
              </Button>
              <Button variant="ghost" size="sm" onClick={onReset}>
                Cancelar
              </Button>
            </>
          }
        >
          Um lote com o mesmo conteúdo (SHA-256) já foi concluído. Importar de novo duplica as transações no dashboard.
        </Alert>
      );

    case "rejected":
      return (
        <Alert tone="danger" title={rejectedTitle(state.error)} actions={<Button variant="secondary" size="sm" onClick={onReset}>Escolher outro arquivo</Button>}>
          <p>{errorMessage(state.error)}</p>
          {isApiError(state.error, "SCHEMA_MISMATCH") && <MismatchList {...SchemaMismatchErrors.catch({ missing: [], unexpected: [], duplicated: [] }).parse(state.error.errors)} />}
          {isApiError(state.error, "TENANT_BATCH_LIMIT") && (
            <p className="mt-1">
              Aguarde algum dos <Link href="/batches?status=active" className="underline">lotes em andamento</Link> terminar.
            </p>
          )}
        </Alert>
      );

    case "failed":
      return (
        <Alert
          tone="danger"
          title="O envio foi interrompido"
          actions={
            <>
              {state.retryable && (
                <Button size="sm" onClick={() => onRetry()}>
                  Retomar envio
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Desistir
              </Button>
            </>
          }
        >
          {state.message} As partes já enviadas ficam guardadas.
        </Alert>
      );
  }
}

function Step({ title, description, file, progress, actions }: { title: string; description?: string; file: File; progress: number | null; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0" aria-live="polite">
          <p className="font-medium">{title}</p>
          <p className="truncate text-sm text-muted">
            {file.name} · {formatBytes(file.size)}
          </p>
        </div>
        {actions}
      </div>
      <ProgressBar label={title} value={progress} />
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

function MismatchList({ missing, unexpected, duplicated }: { missing: string[]; unexpected: string[]; duplicated: string[] }) {
  const rows = [
    ["Faltando", missing],
    ["Inesperadas", unexpected],
    ["Duplicadas", duplicated],
  ] as const;
  if (!rows.some(([, cols]) => cols.length)) return null;
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {rows
        .filter(([, cols]) => cols.length)
        .map(([label, cols]) => (
          <div key={label} className="contents">
            <dt className="font-medium">{label}:</dt>
            <dd className="font-mono text-xs leading-5">{cols.join(", ")}</dd>
          </div>
        ))}
    </dl>
  );
}

function invalidTitle(code: string) {
  if (code === "SCHEMA_MISMATCH") return "O cabeçalho não confere";
  if (code === "DELIMITER_UNDETECTED") return "Separador não identificado";
  if (code === "UNSUPPORTED_FORMAT") return "Formato não suportado";
  return "Arquivo não aceito";
}

function rejectedTitle(err: ApiError) {
  if (err.code === "FILE_TOO_LARGE") return "Arquivo grande demais";
  if (err.code === "QUOTA_EXCEEDED") return "Cota mensal de upload esgotada";
  if (err.code === "TENANT_BATCH_LIMIT") return "Limite de lotes em andamento";
  if (err.code === "INVALID_FILENAME") return "Nome de arquivo inválido";
  return invalidTitle(err.code);
}
