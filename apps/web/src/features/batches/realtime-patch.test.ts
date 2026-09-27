import type { BatchEvent, BatchSummary } from "@datapulse/contracts";
import { describe, expect, it } from "vitest";
import { applyBatchEvent, isNewer } from "./realtime-patch";

const id = "0192f0c4-7a1e-7c3b-9d2a-5b8e4f1a6c00";
const base: BatchSummary = {
  batch_id: id,
  filename: "vendas.csv",
  status: "QUEUED",
  size_bytes: 1000,
  created_at: "2026-09-25T14:00:00Z",
};

const ev = <T extends BatchEvent["type"]>(type: T, data: Extract<BatchEvent, { type: T }>["data"], at = "2026-09-25T14:08:00Z") =>
  ({ v: 1, type, batch_id: id, attempt: 1, occurred_at: at, data }) as Extract<BatchEvent, { type: T }>;

describe("applyBatchEvent (§9.3)", () => {
  it("progress em parsing mantém PROCESSING e calcula a taxa", () => {
    const next = applyBatchEvent(
      base,
      ev("batch.progress", { phase: "parsing", bytes_read: 470, size_bytes: 1000, percent: 44, rows_valid: 90, rows_invalid: 10 }),
    );
    expect(next.status).toBe("PROCESSING");
    expect(next.progress).toEqual({ phase: "parsing", bytes_read: 470, percent: 44 });
    expect(next.rows).toEqual({ total: 100, valid: 90, invalid: 10, invalid_ratio: 0.1 });
  });

  it("progress em consolidating vira CONSOLIDATING", () => {
    const next = applyBatchEvent(
      base,
      ev("batch.progress", { phase: "consolidating", bytes_read: 1000, size_bytes: 1000, percent: 95, rows_valid: 1, rows_invalid: 0 }),
    );
    expect(next.status).toBe("CONSOLIDATING");
  });

  it("completed leva a 100% com o status final", () => {
    const next = applyBatchEvent(
      base,
      ev("batch.completed", { status: "PARTIAL", rows_total: 1000, rows_valid: 950, rows_invalid: 50, invalid_ratio: 0.05 }),
    );
    expect(next).toMatchObject({ status: "PARTIAL", progress: { percent: 100 }, rows: { invalid: 50 } });
  });

  it("failed guarda o motivo", () => {
    const next = applyBatchEvent(
      base,
      ev("batch.failed", { status: "FAILED_VALIDATION", reason_code: "ERROR_RATE_EXCEEDED", rows_total: 1000, rows_invalid: 51 }),
    );
    expect(next).toMatchObject({ status: "FAILED_VALIDATION", status_reason: "ERROR_RATE_EXCEEDED", rows: { valid: 949 } });
  });

  it("aplicar o mesmo evento duas vezes dá o mesmo estado", () => {
    const e = ev("batch.started", { attempt: 2 });
    expect(applyBatchEvent(applyBatchEvent(base, e), e)).toEqual(applyBatchEvent(base, e));
  });
});

describe("isNewer", () => {
  const e = ev("batch.started", { attempt: 1 }, "2026-09-25T14:08:00Z");

  it("aceita o primeiro evento do lote", () => {
    expect(isNewer(e, undefined)).toBe(true);
  });

  it("descarta evento mais antigo que o último aplicado ou que o snapshot", () => {
    expect(isNewer(e, "2026-09-25T14:09:00Z")).toBe(false);
    expect(isNewer(e, undefined, "2026-09-25T14:09:00Z")).toBe(false);
    expect(isNewer(e, "2026-09-25T14:07:00Z", "2026-09-25T14:07:30Z")).toBe(true);
  });
});
