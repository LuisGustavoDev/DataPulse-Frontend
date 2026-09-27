import type { Summary } from "@datapulse/contracts";
import { formatCurrency, formatInt, formatPercent } from "@/lib/format";

/** KPIs do §8.5 como números em destaque: são manchetes, não gráficos. */
export function KpiCards({ summary, loading }: { summary: Summary | undefined; loading: boolean }) {
  const items = [
    { label: "Volume transacionado", value: formatCurrency(summary?.amount_total), hint: "Todos os status" },
    { label: "Transações", value: formatInt(summary?.tx_count) },
    { label: "Ticket médio", value: formatCurrency(summary?.avg_ticket) },
    { label: "Valor aprovado", value: formatCurrency(summary?.amount_approved), hint: "Status aprovada" },
    { label: "Taxa de cancelamento", value: formatPercent(summary?.cancellation_rate), hint: "Canceladas + estornadas" },
    {
      label: "Clientes únicos",
      value: summary?.unique_clients_available ? formatInt(summary.unique_clients) : "—",
      hint: summary && !summary.unique_clients_available ? "Só por lote, sem filtros" : undefined,
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-surface p-4">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums break-words">{loading && !summary ? "…" : item.value}</dd>
          {item.hint && <dd className="mt-0.5 text-xs text-muted">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
