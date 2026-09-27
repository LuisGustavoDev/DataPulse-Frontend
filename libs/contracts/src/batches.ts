import { z } from "zod";
import { Count, IsoDate, IsoDateTime, Uuid, page } from "./common";

// §4 Máquina de estados do lote

export const BatchStatus = z.enum([
  "AWAITING_UPLOAD",
  "QUEUED",
  "PROCESSING",
  "CONSOLIDATING",
  "SUCCEEDED",
  "PARTIAL",
  "FAILED_VALIDATION",
  "FAILED_TECHNICAL",
  "REJECTED_SCHEMA",
  "REJECTED_DUPLICATE",
  "ABANDONED",
  "DELETING",
  "DELETED",
]);
export type BatchStatus = z.infer<typeof BatchStatus>;

export const TERMINAL_STATUSES: ReadonlySet<BatchStatus> = new Set([
  "SUCCEEDED",
  "PARTIAL",
  "FAILED_VALIDATION",
  "FAILED_TECHNICAL",
  "REJECTED_SCHEMA",
  "REJECTED_DUPLICATE",
  "ABANDONED",
  "DELETED",
]);

/** `?status=active` do GET /batches: todos os status não terminais (§10.3, R2). */
export const ACTIVE_STATUSES: readonly BatchStatus[] = BatchStatus.options.filter(
  (s) => !TERMINAL_STATUSES.has(s),
);

export const isTerminal = (status: BatchStatus) => TERMINAL_STATUSES.has(status);

/** Só lotes com dados consolidados alimentam o dashboard. */
export const hasAnalytics = (status: BatchStatus) => status === "SUCCEEDED" || status === "PARTIAL";

/** FAILED_TECHNICAL é o único estado de falha que aceita nova tentativa. */
export const canRetry = (status: BatchStatus) => status === "FAILED_TECHNICAL";

/** Só lotes terminais podem ser excluídos (R4); DELETED já foi. */
export const canDelete = (status: BatchStatus) => isTerminal(status) && status !== "DELETED";

/** Anomalias existem quando o worker chegou a ler o arquivo. */
export const hasAnomalies = (status: BatchStatus) =>
  status === "PARTIAL" || status === "FAILED_VALIDATION";

// §8.3 Lotes

export const MAX_FILE_BYTES = 1_073_741_824; // 1 GiB
export const MAX_FILENAME_LENGTH = 255;

export const CreateBatchBody = z.object({
  filename: z.string().min(1).max(MAX_FILENAME_LENGTH),
  size_bytes: z.number().int().positive().max(MAX_FILE_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  allow_duplicate: z.boolean(),
});
export type CreateBatchBody = z.infer<typeof CreateBatchBody>;

export const PartUrl = z.object({
  part_number: z.number().int().positive(),
  url: z.url(),
});
export type PartUrl = z.infer<typeof PartUrl>;

export const CreateBatchResponse = z.object({
  batch_id: Uuid,
  status: BatchStatus,
  upload: z.object({
    part_size_bytes: z.number().int().positive(),
    part_count: z.number().int().positive(),
    parts: z.array(PartUrl),
    expires_at: IsoDateTime,
  }),
});
export type CreateBatchResponse = z.infer<typeof CreateBatchResponse>;

export const UploadedPart = z.object({
  part_number: z.number().int().positive(),
  etag: z.string(),
  size: z.number().int().nonnegative(),
});
export type UploadedPart = z.infer<typeof UploadedPart>;

export const UploadedPartsResponse = z.object({ parts: z.array(UploadedPart) });

export const RenewPartsBody = z.object({ part_numbers: z.array(z.number().int().positive()).min(1) });

export const RenewPartsResponse = z.object({
  parts: z.array(PartUrl),
  expires_at: IsoDateTime,
});
export type RenewPartsResponse = z.infer<typeof RenewPartsResponse>;

export const CompleteBody = z.object({
  parts: z.array(z.object({ part_number: z.number().int().positive(), etag: z.string() })).min(1),
});
export type CompleteBody = z.infer<typeof CompleteBody>;

export const CompleteResponse = z.object({
  batch_id: Uuid,
  status: BatchStatus,
  queue: z.enum(["express", "heavy"]).nullish(),
  size_bytes: z.number().int().nullish(),
  encoding: z.enum(["utf-8", "windows-1252"]).nullish(),
  delimiter: z.enum([",", ";"]).nullish(),
});
export type CompleteResponse = z.infer<typeof CompleteResponse>;

/** Detalhes do 409 DUPLICATE_FILE e do 422 SCHEMA_MISMATCH, em `errors`. */
export const DuplicateFileErrors = z.object({ existing_batch_id: Uuid });
export const SchemaMismatchErrors = z.object({
  missing: z.array(z.string()).default([]),
  unexpected: z.array(z.string()).default([]),
  duplicated: z.array(z.string()).default([]),
});

export const BatchPhase = z.enum(["waiting", "parsing", "consolidating", "done"]).or(z.string());

export const BatchProgress = z.object({
  phase: BatchPhase,
  bytes_read: Count,
  percent: z.number().min(0).max(100),
});
export type BatchProgress = z.infer<typeof BatchProgress>;

export const BatchRows = z.object({
  total: Count,
  valid: Count,
  invalid: Count,
  invalid_ratio: z.number().nullable(),
});
export type BatchRows = z.infer<typeof BatchRows>;

/** Item do histórico. O detalhe (GET /batches/{id}) é um superconjunto. */
export const BatchSummary = z.object({
  batch_id: Uuid,
  filename: z.string(),
  status: BatchStatus,
  status_reason: z.string().nullish(),
  size_bytes: Count.nullish(),
  attempt: z.number().int().nonnegative().optional(),
  progress: BatchProgress.nullish(),
  rows: BatchRows.nullish(),
  created_at: IsoDateTime,
  finished_at: IsoDateTime.nullish(),
  /** Instante do snapshot, comparado com occurred_at dos eventos (§9.3). */
  as_of: IsoDateTime.optional(),
});
export type BatchSummary = z.infer<typeof BatchSummary>;

export const BatchDetail = BatchSummary.extend({
  queue: z.enum(["express", "heavy"]).nullish(),
  error_counts: z.array(z.object({ code: z.string(), count: Count })).default([]),
  date_range: z.object({ min: IsoDate.nullable(), max: IsoDate.nullable() }).nullish(),
  created_by: z.object({ id: Uuid, email: z.string() }).nullish(),
  queued_at: IsoDateTime.nullish(),
  started_at: IsoDateTime.nullish(),
  raw_file_available_until: IsoDateTime.nullish(),
});
export type BatchDetail = z.infer<typeof BatchDetail>;

export const BatchPage = page(BatchSummary);
export type BatchPage = z.infer<typeof BatchPage>;

export type BatchListFilters = {
  status?: BatchStatus | "active";
  from?: string;
  to?: string;
  q?: string;
};
