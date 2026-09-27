"use client";

import type { Granularity, StatusBreakdownItem, TimeseriesPoint, TopProduct } from "@datapulse/contracts";
import { useCallback } from "react";
import { EChart, baseAxes, baseTooltip, type ChartTheme } from "@/components/charts/echart";
import { TX_STATUS_LABEL } from "@/features/batches/labels";
import { formatCompact, formatCompactCurrency, formatCurrency, formatDate, formatInt, formatPercent } from "@/lib/format";

// Um eixo por gráfico: volume e quantidade têm escalas diferentes, então o usuário
// alterna a métrica em vez de ver dois eixos y.

/** Tooltips do ECharts são HTML: dado vindo do CSV passa por escape. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function periodLabel(periodStart: string, granularity: Granularity): string {
  const [y, m, d] = periodStart.split("-");
  if (granularity === "month") return `${MONTHS[Number(m) - 1]}/${y?.slice(2)}`;
  if (granularity === "week") return `sem. ${d}/${m}`;
  return `${d}/${m}`;
}

type Metric = "amount" | "count";

const metricValue = (p: { amount_total: string; tx_count: number }, metric: Metric) =>
  metric === "amount" ? Number(p.amount_total) : p.tx_count;

const metricFormat = (metric: Metric) => (metric === "amount" ? formatCompactCurrency : formatCompact);

export function TimeseriesChart({ data, granularity, metric }: { data: TimeseriesPoint[]; granularity: Granularity; metric: Metric }) {
  const option = useCallback(
    (t: ChartTheme) => ({
      grid: { left: 8, right: 16, top: 16, bottom: 8, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
      tooltip: {
        ...baseTooltip(t),
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: t.muted, type: "dashed" } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const p = data[params[0]?.dataIndex ?? 0];
          if (!p) return "";
          return `<strong>${formatDate(p.period_start)}</strong><br/>Volume: ${formatCurrency(p.amount_total)}<br/>Transações: ${formatInt(p.tx_count)}`;
        },
      },
      xAxis: {
        type: "category",
        data: data.map((p) => periodLabel(p.period_start, granularity)),
        boundaryGap: false,
        ...baseAxes(t),
        splitLine: { show: false },
      },
      yAxis: { type: "value", ...baseAxes(t), axisLabel: { ...baseAxes(t).axisLabel, formatter: metricFormat(metric) } },
      series: [
        {
          type: "line",
          name: metric === "amount" ? "Volume" : "Transações",
          data: data.map((p) => metricValue(p, metric)),
          lineStyle: { width: 2, color: t.series[0] },
          itemStyle: { color: t.series[0], borderColor: t.surface, borderWidth: 2 },
          symbol: "circle",
          symbolSize: 8,
          showSymbol: data.length <= 31,
          areaStyle: { color: t.series[0], opacity: 0.08 },
        },
      ],
    }),
    [data, granularity, metric],
  );

  const label = `Evolução ${metric === "amount" ? "do volume transacionado" : "da quantidade de transações"} por ${
    granularity === "day" ? "dia" : granularity === "week" ? "semana" : "mês"
  }, ${data.length} períodos.`;
  return <EChart option={option} ariaLabel={label} />;
}

/** Barras horizontais: o rótulo no eixo identifica cada barra, sem depender de cor. */
function HorizontalBars({
  labels,
  values,
  valueLabels,
  tooltip,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  valueLabels: string[];
  tooltip: (i: number) => string;
  ariaLabel: string;
}) {
  const option = useCallback(
    (t: ChartTheme) => ({
      grid: { left: 8, right: 96, top: 8, bottom: 8, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
      tooltip: { ...baseTooltip(t), trigger: "item", formatter: (p: { dataIndex: number }) => tooltip(p.dataIndex) },
      xAxis: { type: "value", ...baseAxes(t), axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: {
        type: "category",
        data: labels,
        inverse: true,
        ...baseAxes(t),
        axisLabel: { color: t.text, fontSize: 12, width: 120, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: values,
          barMaxWidth: 22,
          itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: "right",
            color: t.muted,
            fontSize: 11,
            formatter: (p: { dataIndex: number }) => valueLabels[p.dataIndex] ?? "",
          },
        },
      ],
    }),
    [labels, values, valueLabels, tooltip],
  );
  return <EChart option={option} ariaLabel={ariaLabel} className="h-64" />;
}

export function StatusBreakdownChart({ data }: { data: StatusBreakdownItem[] }) {
  const sorted = [...data].sort((a, b) => Number(b.amount_total) - Number(a.amount_total));
  return (
    <HorizontalBars
      labels={sorted.map((d) => TX_STATUS_LABEL[d.status])}
      values={sorted.map((d) => Number(d.amount_total))}
      valueLabels={sorted.map((d) => formatPercent(d.share))}
      tooltip={(i) => {
        const d = sorted[i];
        return d
          ? `<strong>${TX_STATUS_LABEL[d.status]}</strong><br/>${formatCurrency(d.amount_total)}<br/>${formatInt(d.tx_count)} transações · ${formatPercent(d.share)}`
          : "";
      }}
      ariaLabel={`Volume por status: ${sorted.map((d) => `${TX_STATUS_LABEL[d.status]} ${formatPercent(d.share)}`).join(", ")}.`}
    />
  );
}

export function TopProductsChart({ data, orderBy }: { data: TopProduct[]; orderBy: Metric }) {
  return (
    <HorizontalBars
      labels={data.map((d) => d.product_id)}
      values={data.map((d) => metricValue(d, orderBy))}
      valueLabels={data.map((d) => (orderBy === "amount" ? formatCompactCurrency(Number(d.amount_total)) : formatInt(d.tx_count)))}
      tooltip={(i) => {
        const d = data[i];
        return d ? `<strong>${esc(d.product_id)}</strong><br/>${formatCurrency(d.amount_total)}<br/>${formatInt(d.tx_count)} transações` : "";
      }}
      ariaLabel={`Top ${data.length} produtos por ${orderBy === "amount" ? "volume" : "quantidade"}.`}
    />
  );
}
