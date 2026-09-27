"use client";

import { Granularity } from "@datapulse/contracts";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency, formatInt } from "@/lib/format";
import { useDashboardState } from "../filters";
import { useStatusBreakdown, useSummary, useTimeseries, useTopClients, useTopProducts } from "../hooks";
import { StatusBreakdownChart, TimeseriesChart, TopProductsChart } from "./charts";
import { FiltersBar } from "./filters-bar";
import { KpiCards } from "./kpi-cards";
import { TransactionsTable } from "./transactions-table";

const GRANULARITY_LABEL: Record<Granularity, string> = { day: "Dia", week: "Semana", month: "Mês" };

/**
 * Dashboard consolidado (sem batchId: todos os lotes SUCCEEDED e PARTIAL do tenant) ou
 * de um lote. Os filtros ficam na query string, então o link é compartilhável.
 */
export function DashboardView({ batchId }: { batchId?: string }) {
  const state = useDashboardState(batchId);
  const { filters, granularity, metric, topOrder, rangeError, drilldownAllowed, set } = state;
  const enabled = !rangeError;

  const summary = useSummary(filters, enabled);
  const series = useTimeseries(filters, granularity, enabled);
  const status = useStatusBreakdown(filters, enabled);
  const top = useTopProducts(filters, topOrder, enabled);
  const clients = useTopClients(batchId);

  const empty = summary.data?.tx_count === 0;

  return (
    <div className="flex flex-col gap-6">
      <FiltersBar {...state} set={set} showPeriod />
      {rangeError && <Alert tone="warning">{rangeError}</Alert>}
      {summary.isError && <Alert tone="danger" title="Não foi possível carregar o dashboard">{errorMessage(summary.error)}</Alert>}

      <KpiCards summary={summary.data} loading={summary.isFetching} />

      {empty ? (
        <EmptyState
          title="Sem transações para mostrar"
          description={batchId ? "Este lote não tem transações com esses filtros." : "Nenhum lote concluído com esses filtros. Envie um CSV ou ajuste o período."}
        />
      ) : (
        <>
          <Card>
            <CardHeader
              title={metric === "amount" ? "Volume transacionado" : "Quantidade de transações"}
              actions={
                <>
                  <Segmented
                    label="Métrica"
                    value={metric}
                    options={[
                      ["amount", "Volume"],
                      ["count", "Quantidade"],
                    ]}
                    onChange={(v) => set({ metric: v === "amount" ? null : v })}
                  />
                  <Segmented
                    label="Agrupar por"
                    value={granularity}
                    options={Granularity.options.map((g) => [g, GRANULARITY_LABEL[g]] as const)}
                    onChange={(v) => set({ granularity: v })}
                  />
                </>
              }
            />
            <ChartSlot query={series} empty={series.data?.length === 0}>
              {series.data && <TimeseriesChart data={series.data} granularity={granularity} metric={metric} />}
            </ChartSlot>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Volume por status" description="Participação de cada status no volume." />
              <ChartSlot query={status} empty={status.data?.length === 0}>
                {status.data && <StatusBreakdownChart data={status.data} />}
              </ChartSlot>
            </Card>
            <Card>
              <CardHeader
                title="Top 10 produtos"
                actions={
                  <Segmented
                    label="Ordenar por"
                    value={topOrder}
                    options={[
                      ["amount", "Volume"],
                      ["count", "Quantidade"],
                    ]}
                    onChange={(v) => set({ top: v === "amount" ? null : v })}
                  />
                }
              />
              <ChartSlot query={top} empty={top.data?.length === 0}>
                {top.data && <TopProductsChart data={top.data} orderBy={topOrder} />}
              </ChartSlot>
            </Card>
          </div>

          {batchId && (
            <Card>
              <CardHeader title="Top 20 clientes do lote" description="Calculado sobre o lote inteiro, sem os filtros de período e status." />
              <ChartSlot query={clients} empty={clients.data?.length === 0}>
                <ol className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  {clients.data?.map((c, i) => (
                    <li key={c.client_id} className="flex items-baseline justify-between gap-4 border-b border-border py-1.5">
                      <span className="truncate">
                        <span className="mr-2 inline-block w-6 text-right tabular-nums text-muted">{c.rank ?? i + 1}.</span>
                        <span className="font-mono text-xs">{c.client_id}</span>
                      </span>
                      <span className="tabular-nums whitespace-nowrap">
                        {formatCurrency(c.amount_total)} <span className="text-xs text-muted">· {formatInt(c.tx_count)} tx</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </ChartSlot>
            </Card>
          )}

          <TransactionsTable
            filters={filters}
            allowed={enabled && drilldownAllowed}
            clientId={state.clientId}
            productId={state.productId}
            onChange={({ client, product }) => set({ ...(client !== undefined && { client }), ...(product !== undefined && { product }) })}
          />
        </>
      )}
    </div>
  );
}

function ChartSlot({ query, empty, children }: { query: { isPending: boolean; isError: boolean; error: unknown }; empty: boolean; children: ReactNode }) {
  if (query.isPending) {
    return (
      <div className="flex h-64 items-center justify-center text-primary">
        <Spinner label="Carregando…" />
      </div>
    );
  }
  if (query.isError) return <Alert tone="danger">{errorMessage(query.error)}</Alert>;
  if (empty) return <p className="py-10 text-center text-sm text-muted">Sem dados no período.</p>;
  return <>{children}</>;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-border p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className="rounded px-2.5 py-1 text-xs text-muted aria-pressed:bg-surface-2 aria-pressed:font-medium aria-pressed:text-fg"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
