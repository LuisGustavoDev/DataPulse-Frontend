"use client";

import { canDelete, canRetry, type BatchDetail } from "@datapulse/contracts";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useDeleteBatch, useRetryBatch } from "../hooks";

export function BatchActions({ batch }: { batch: BatchDetail }) {
  const retry = useRetryBatch(batch.batch_id);
  const remove = useDeleteBatch(batch.batch_id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const error = retry.error ?? remove.error;
  const errorText = isApiError(error, "OBJECT_EXPIRED")
    ? "O arquivo original já expirou. Envie o CSV de novo."
    : isApiError(error, "INVALID_STATE")
      ? "O lote mudou de estado enquanto você olhava. A tela foi atualizada."
      : error
        ? errorMessage(error)
        : null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {canRetry(batch.status) && (
          <Button variant="secondary" loading={retry.isPending} onClick={() => retry.mutate()}>
            Tentar de novo
          </Button>
        )}
        {canDelete(batch.status) && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Excluir lote
          </Button>
        )}
      </div>
      {errorText && <Alert tone="danger">{errorText}</Alert>}
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir este lote?"
        confirmLabel="Excluir"
        tone="danger"
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(undefined, { onSettled: () => setConfirmDelete(false) })}
      >
        <p>
          As transações, os totais do dashboard, as anomalias e o arquivo de <strong className="text-fg">{batch.filename}</strong> serão
          apagados. O registro do lote fica no histórico para auditoria. Não dá para desfazer.
        </p>
      </ConfirmDialog>
    </div>
  );
}
