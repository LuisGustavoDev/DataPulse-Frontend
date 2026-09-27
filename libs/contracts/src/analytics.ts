import { z } from "zod";
import { Count, Decimal, IsoDate, page } from "./common";

// §8.5 Analytics

export const TxStatus = z.enum(["aprovada", "pendente", "cancelada", "estornada"]);
export type TxStatus = z.infer<typeof TxStatus>;

export const Granularity = z.enum(["day", "week", "month"]);
export type Granularity = z.infer<typeof Granularity>;

/** Janela máxima de from/to (inclusivos). */
export const MAX_ANALYTICS_WINDOW_DAYS = 731;

/** O drill-down sem batch_id exige janela de até 31 dias. */
export const MAX_DRILLDOWN_WINDOW_DAYS = 31;

export type AnalyticsFilters = {
  batch_id?: string;
  from?: string;
  to?: string;
  status?: TxStatus[];
};

export const Summary = z.object({
  amount_total: Decimal,
  tx_count: Count,
  avg_ticket: Decimal.nullable(),
  amount_approved: Decimal,
  cancellation_rate: z.number().nullable(),
  unique_clients: Count.nullable(),
  unique_clients_available: z.boolean(),
});
export type Summary = z.infer<typeof Summary>;

export const TimeseriesPoint = z.object({
  period_start: IsoDate,
  tx_count: Count,
  amount_total: Decimal,
});
export type TimeseriesPoint = z.infer<typeof TimeseriesPoint>;
export const Timeseries = z.array(TimeseriesPoint);

export const StatusBreakdownItem = z.object({
  status: TxStatus,
  tx_count: Count,
  amount_total: Decimal,
  share: z.number(),
});
export type StatusBreakdownItem = z.infer<typeof StatusBreakdownItem>;
export const StatusBreakdown = z.array(StatusBreakdownItem);

export const TopProduct = z.object({
  product_id: z.string(),
  tx_count: Count,
  amount_total: Decimal,
});
export type TopProduct = z.infer<typeof TopProduct>;
export const TopProducts = z.array(TopProduct);

export const TopClient = z.object({
  rank: z.number().int().optional(),
  client_id: z.string(),
  tx_count: Count,
  amount_total: Decimal,
});
export type TopClient = z.infer<typeof TopClient>;
export const TopClients = z.array(TopClient);

export const Transaction = z.object({
  batch_id: z.string().optional(),
  line_number: z.number().int().positive(),
  tx_date: IsoDate,
  amount: Decimal,
  client_id: z.string(),
  product_id: z.string(),
  status: TxStatus,
});
export type Transaction = z.infer<typeof Transaction>;

export const TransactionPage = page(Transaction);
export type TransactionPage = z.infer<typeof TransactionPage>;
