import { z } from "zod";
import { Count, IsoDateTime } from "./common";

// §8.4 Anomalias

export const Anomaly = z.object({
  line_number: z.number().int().positive(),
  error_code: z.string(),
  column: z.string().nullable(),
  message: z.string(),
  raw_line: z.string().nullable(),
});
export type Anomaly = z.infer<typeof Anomaly>;

/** `stored` é o que está no Postgres (até 50.000); `total` é a contagem completa. */
export const AnomalyPage = z.object({
  items: z.array(Anomaly),
  next_cursor: z.string().nullable(),
  stored: Count,
  total: Count,
  truncated: z.boolean(),
});
export type AnomalyPage = z.infer<typeof AnomalyPage>;

export const AnomalyExport = z.object({
  url: z.url(),
  expires_at: IsoDateTime,
  rows: Count,
});
export type AnomalyExport = z.infer<typeof AnomalyExport>;
