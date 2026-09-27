"use client";

import { BatchStatus, type BatchListFilters } from "@datapulse/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/errors";
import { formatBytes, formatDateTime, formatInt, formatPercent } from "@/lib/format";
import { useUrlParams } from "@/lib/url-state";
import { useBatchList } from "../hooks";
import { BATCH_STATUS } from "../labels";
import { BatchProgress } from "./batch-progress";
import { StatusBadge } from "./status-badge";

function parseStatus(value: string | undefined): BatchListFilters["status"] {
  if (value === "active") return "active";
  const parsed = BatchStatus.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function BatchListView() {
  const url = useUrlParams();
  const filters: BatchListFilters = {
    status: parseStatus(url.get("status")),
    from: url.get("from"),
    to: url.get("to"),
    q: url.get("q")?.trim() || undefined,
  };
  const query = useBatchList(filters);
  const batches = query.data?.pages.flatMap((p) => p.items) ?? [];
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title="Lotes"
        description="Histórico de arquivos enviados pela sua empresa, do mais recente ao mais antigo."
        actions={<ButtonLink href="/batches/new">Novo upload</ButtonLink>}
      />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr_auto] lg:items-end">
          <SearchField value={filters.q ?? ""} onChange={(q) => url.set({ q })} />
          <Field label="Status">
            {(p) => (
              <Select {...p} value={filters.status ?? ""} onChange={(e) => url.set({ status: e.target.value })}>
                <option value="">Todos</option>
                <option value="active">Em andamento</option>
                {BatchStatus.options
                  .filter((s) => s !== "DELETED")
                  .map((s) => (
                    <option key={s} value={s}>
                      {BATCH_STATUS[s].label}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="De">
            {(p) => <Input {...p} type="date" value={filters.from ?? ""} max={filters.to} onChange={(e) => url.set({ from: e.target.value })} />}
          </Field>
          <Field label="Até">
            {(p) => <Input {...p} type="date" value={filters.to ?? ""} min={filters.from} onChange={(e) => url.set({ to: e.target.value })} />}
          </Field>
          <Button variant="ghost" disabled={!hasFilters} onClick={() => url.set({ q: null, status: null, from: null, to: null })}>
            Limpar
          </Button>
        </div>
      </Card>

      {query.isPending ? (
        <div className="py-10 text-center text-primary">
          <Spinner label="Carregando lotes…" />
        </div>
      ) : query.isError ? (
        <Alert tone="danger" title="Não foi possível carregar os lotes" actions={<Button variant="secondary" size="sm" onClick={() => query.refetch()}>Tentar de novo</Button>}>
          {errorMessage(query.error)}
        </Alert>
      ) : batches.length === 0 ? (
        hasFilters ? (
          <EmptyState title="Nenhum lote com esses filtros" description="Ajuste a busca ou limpe os filtros." />
        ) : (
          <EmptyState
            title="Nenhum lote ainda"
            description="Envie o primeiro CSV de transações para ver anomalias e o dashboard."
            action={<ButtonLink href="/batches/new">Enviar CSV</ButtonLink>}
          />
        )
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Lotes enviados</caption>
              <thead className="border-b border-border bg-surface-2 text-left text-xs text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Arquivo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Linhas</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Inválidas</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Tamanho</th>
                  <th scope="col" className="px-4 py-3 font-medium">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.map((b) => (
                  <tr key={b.batch_id} className="hover:bg-surface-2/60">
                    <td className="max-w-72 px-4 py-3">
                      <Link href={`/batches/${b.batch_id}`} className="block truncate font-medium text-primary hover:underline">
                        {b.filename}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <StatusBadge status={b.status} />
                        <BatchProgress batch={b} compact />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatInt(b.rows?.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {b.rows ? `${formatInt(b.rows.invalid)} (${formatPercent(b.rows.invalid_ratio, 2)})` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatBytes(b.size_bytes)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="secondary" size="sm" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                Carregar mais
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

/** Busca por nome com debounce, para não disparar uma requisição por tecla. */
function SearchField({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  // Sincroniza quando a URL muda por fora (voltar, "Limpar"), sem remontar o campo.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (value !== draft.trim()) setDraft(value);
  }

  useEffect(() => {
    if (draft.trim() === value) return;
    const t = setTimeout(() => onChange(draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);

  return (
    <Field label="Buscar pelo nome do arquivo">
      {(p) => <Input {...p} type="search" placeholder="vendas_agosto.csv" value={draft} onChange={(e) => setDraft(e.target.value)} />}
    </Field>
  );
}
