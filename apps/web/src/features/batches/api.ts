import {
  AnomalyExport,
  AnomalyPage,
  BatchDetail,
  BatchPage,
  CompleteResponse,
  CreateBatchResponse,
  RenewPartsResponse,
  UploadedPartsResponse,
  type BatchListFilters,
  type CompleteBody,
  type CreateBatchBody,
} from "@datapulse/contracts";
import { apiFetch } from "@/lib/api/client";

// §8.3 Lotes e §8.4 Anomalias

export const PAGE_SIZE = 20;

export const batchesApi = {
  list: (filters: BatchListFilters, cursor?: string, signal?: AbortSignal) =>
    apiFetch("/batches", { query: { ...filters, cursor, limit: PAGE_SIZE }, schema: BatchPage, signal }),

  get: (id: string, signal?: AbortSignal) =>
    apiFetch(`/batches/${encodeURIComponent(id)}`, { schema: BatchDetail, signal }),

  retry: (id: string) => apiFetch(`/batches/${encodeURIComponent(id)}/retry`, { method: "POST" }),

  remove: (id: string) => apiFetch(`/batches/${encodeURIComponent(id)}`, { method: "DELETE" }),

  anomalies: (id: string, errorCode: string | undefined, cursor: string | undefined, signal?: AbortSignal) =>
    apiFetch(`/batches/${encodeURIComponent(id)}/anomalies`, {
      query: { error_code: errorCode, cursor, limit: 50 },
      schema: AnomalyPage,
      signal,
    }),

  exportAnomalies: (id: string) =>
    apiFetch(`/batches/${encodeURIComponent(id)}/anomalies/export`, { schema: AnomalyExport }),

  // Upload multipart (ADR 03)

  create: (body: CreateBatchBody) => apiFetch("/batches", { method: "POST", body, schema: CreateBatchResponse }),

  uploadedParts: (id: string) =>
    apiFetch(`/batches/${encodeURIComponent(id)}/upload/parts`, { schema: UploadedPartsResponse }),

  renewParts: (id: string, partNumbers: number[]) =>
    apiFetch(`/batches/${encodeURIComponent(id)}/upload/parts`, {
      method: "POST",
      body: { part_numbers: partNumbers },
      schema: RenewPartsResponse,
    }),

  complete: (id: string, body: CompleteBody) =>
    apiFetch(`/batches/${encodeURIComponent(id)}/complete`, { method: "POST", body, schema: CompleteResponse }),

  abort: (id: string) => apiFetch(`/batches/${encodeURIComponent(id)}/abort`, { method: "POST" }),
};
