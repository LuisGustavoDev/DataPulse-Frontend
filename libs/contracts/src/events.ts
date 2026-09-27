import { z } from "zod";
import { BatchStatus } from "./batches";
import { Count, IsoDateTime, Uuid } from "./common";

// §9.3 Envelope e tipos de evento. Um evento carrega estado, não incremento.

const envelope = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.object({
    v: z.literal(1),
    type: z.literal(type),
    batch_id: Uuid,
    attempt: z.number().int().nonnegative(),
    occurred_at: IsoDateTime,
    data,
  });

export const BatchEvent = z.discriminatedUnion("type", [
  envelope("batch.queued", z.object({ queue: z.enum(["express", "heavy"]) })),
  envelope("batch.started", z.object({ attempt: z.number().int() })),
  envelope(
    "batch.progress",
    z.object({
      phase: z.string(),
      bytes_read: Count,
      size_bytes: Count,
      percent: z.number().min(0).max(100),
      rows_valid: Count,
      rows_invalid: Count,
    }),
  ),
  envelope(
    "batch.retrying",
    z.object({ attempt: z.number().int(), next_attempt_at: IsoDateTime, reason_code: z.string() }),
  ),
  envelope(
    "batch.completed",
    z.object({
      status: BatchStatus,
      rows_total: Count,
      rows_valid: Count,
      rows_invalid: Count,
      invalid_ratio: z.number(),
    }),
  ),
  envelope(
    "batch.failed",
    z.object({
      status: BatchStatus,
      reason_code: z.string().nullable(),
      rows_total: Count,
      rows_invalid: Count,
    }),
  ),
  envelope("batch.deleted", z.object({})),
]);
export type BatchEvent = z.infer<typeof BatchEvent>;
export type BatchEventType = BatchEvent["type"];

export const BATCH_EVENT_TYPES = [
  "batch.queued",
  "batch.started",
  "batch.progress",
  "batch.retrying",
  "batch.completed",
  "batch.failed",
  "batch.deleted",
] as const satisfies readonly BatchEventType[];

// §9.4 Protocolo SSE

export const RealtimeTicket = z.object({
  ticket: z.string(),
  expires_in: z.number().int().positive(),
  stream_url: z.string(),
});
export type RealtimeTicket = z.infer<typeof RealtimeTicket>;

export const ReadyEvent = z.object({ last_event_id: z.string().nullable() });

/** Backoff de reconexão do cliente: 1 s, 2 s, 5 s, 10 s e repete 10 s. */
export const SSE_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;
