import { describe, expect, it } from "vitest";
import { ACTIVE_STATUSES, BatchDetail, BatchEvent, canDelete, canRetry, isTerminal } from "./index";

describe("máquina de estados (§4)", () => {
  it("tem 8 terminais e 5 ativos", () => {
    expect(ACTIVE_STATUSES).toEqual(["AWAITING_UPLOAD", "QUEUED", "PROCESSING", "CONSOLIDATING", "DELETING"]);
  });

  it("só FAILED_TECHNICAL aceita retry", () => {
    expect(canRetry("FAILED_TECHNICAL")).toBe(true);
    expect(canRetry("FAILED_VALIDATION")).toBe(false);
  });

  it("não exclui lote ativo nem já excluído", () => {
    expect(canDelete("PROCESSING")).toBe(false);
    expect(canDelete("DELETED")).toBe(false);
    expect(canDelete("PARTIAL")).toBe(true);
    expect(isTerminal("DELETING")).toBe(false);
  });
});

describe("payloads normativos da spec", () => {
  it("aceita o exemplo de GET /batches/{id} (§8.3)", () => {
    const parsed = BatchDetail.parse({
      batch_id: "0192f0c4-7a1e-7c3b-9d2a-5b8e4f1a6c00",
      filename: "vendas_agosto.csv",
      status: "PARTIAL",
      status_reason: null,
      size_bytes: 734003200,
      queue: "heavy",
      attempt: 1,
      progress: { phase: "done", bytes_read: 734003200, percent: 100 },
      rows: { total: 14820331, valid: 14790112, invalid: 30219, invalid_ratio: 0.00204 },
      error_counts: [{ code: "INVALID_DATE_FORMAT", count: 28001 }],
      date_range: { min: "2026-08-01", max: "2026-08-31" },
      created_by: { id: "0192f0a1-0000-7000-8000-000000000000", email: "helena@exemplo.com.br" },
      created_at: "2026-09-25T14:02:11Z",
      queued_at: "2026-09-25T14:05:40Z",
      started_at: "2026-09-25T14:05:41Z",
      finished_at: "2026-09-25T14:12:09Z",
      raw_file_available_until: "2026-10-25T14:12:09Z",
    });
    expect(parsed.rows?.invalid).toBe(30219);
  });

  it("aceita o exemplo de batch.progress (§9.3)", () => {
    const event = BatchEvent.parse({
      v: 1,
      type: "batch.progress",
      batch_id: "0192f0c4-7a1e-7c3b-9d2a-5b8e4f1a6c00",
      attempt: 1,
      occurred_at: "2026-09-25T14:08:02.114Z",
      data: {
        phase: "parsing",
        bytes_read: 367001600,
        size_bytes: 734003200,
        percent: 47,
        rows_valid: 7401233,
        rows_invalid: 15120,
      },
    });
    expect(event.type).toBe("batch.progress");
  });
});
