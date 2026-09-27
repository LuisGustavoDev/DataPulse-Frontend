"use client";

import type { AnalyticsFilters } from "@datapulse/contracts";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TX_STATUS_LABEL } from "@/features/batches/labels";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate, formatInt } from "@/lib/format";
import { useTransactions } from "../hooks";

type Props = {
  filters: AnalyticsFilters;
  allowed: boolean;
  clientId?: string;
  productId?: string;
  onChange: (patch: { client?: string | null; product?: string | null }) => void;
};

/** Drill-down das transações (§8.5): exige lote ou janela de até 31 dias. */
export function TransactionsTable({ filters, allowed, clientId, productId, onChange }: Props) {
  const query = useTransactions({ ...filters, client_id: clientId, product_id: productId }, allowed);
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Card>
      <CardHeader title="Transações" description="As linhas importadas, com os filtros acima." />
      <div className="mb-4 flex flex-wrap gap-4">
        <DebouncedInput label="cliente_id" value={clientId} onCommit={(v) => onChange({ client: v })} />
        <DebouncedInput label="produto_id" value={productId} onCommit={(v) => onChange({ product: v })} />
      </div>

      {!allowed ? (
        <Alert tone="info">Escolha um período de até 31 dias para listar as transações de todos os lotes.</Alert>
      ) : query.isPending ? (
        <Spinner label="Carregando transações…" />
      ) : query.isError ? (
        <Alert tone="danger">{errorMessage(query.error)}</Alert>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma transação com esses filtros.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Transações importadas</caption>
              <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Data</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                  <th scope="col" className="px-3 py-2 font-medium">Cliente</th>
                  <th scope="col" className="px-3 py-2 font-medium">Produto</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Linha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((t) => (
                  <tr key={`${t.batch_id ?? ""}:${t.line_number}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.tx_date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.amount)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.client_id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.product_id}</td>
                    <td className="px-3 py-2">{TX_STATUS_LABEL[t.status]}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{formatInt(t.line_number)}</td>
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

function DebouncedInput({ label, value, onCommit }: { label: string; value?: string; onCommit: (v: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  // Sincroniza quando a URL muda por fora, sem remontar o campo (e perder o foco).
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if ((value ?? "") !== draft.trim()) setDraft(value ?? "");
  }
  useEffect(() => {
    if (draft.trim() === (value ?? "")) return;
    const t = setTimeout(() => onCommit(draft.trim() || null), 400);
    return () => clearTimeout(t);
  }, [draft, value, onCommit]);

  return (
    <Field label={`Filtrar por ${label}`} className="w-56">
      {(p) => <Input {...p} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-mono" />}
    </Field>
  );
}
