import { describe, expect, it } from "vitest";
import { safeNext } from "@/features/auth/use-auth-form";
import { partCount, partRange } from "@/features/upload/worker/protocol";
import { daysBetweenInclusive, formatBytes, formatCurrency, formatDate, todayIso } from "@/lib/format";
import { reconnectDelay } from "@/lib/realtime/sse-client";

describe("formatação pt-BR (§3.1)", () => {
  it("formata BRL a partir da string decimal, sem perder centavos", () => {
    expect(formatCurrency("1234.56")).toBe("R$ 1.234,56");
    expect(formatCurrency("9999999999999999.99")).toBe("R$ 9.999.999.999.999.999,99");
    expect(formatCurrency(null)).toBe("—");
  });

  it("data de negócio não muda de dia com o fuso", () => {
    expect(formatDate("2026-08-01")).toBe("01/08/2026");
  });

  it("hoje no fuso de São Paulo", () => {
    expect(todayIso(new Date("2026-09-28T02:30:00Z"))).toBe("2026-09-27");
  });

  it("tamanhos em unidades binárias", () => {
    expect(formatBytes(1_073_741_824)).toBe("1 GiB");
    expect(formatBytes(16 * 1024 * 1024)).toBe("16 MiB");
  });

  it("janela de datas inclusiva", () => {
    expect(daysBetweenInclusive("2026-09-01", "2026-09-30")).toBe(30);
  });
});

describe("partes do multipart (ADR 03)", () => {
  const MiB = 1024 * 1024;

  it("1 GiB em partes de 16 MiB dá 64 partes", () => {
    expect(partCount(1024 * MiB, 16 * MiB)).toBe(64);
  });

  it("a última parte pode ser menor", () => {
    expect(partRange(3, 16 * MiB, 40 * MiB)).toEqual([32 * MiB, 40 * MiB]);
  });
});

describe("reconexão do SSE (§9.4)", () => {
  it("1 s, 2 s, 5 s, 10 s e repete 10 s", () => {
    expect([0, 1, 2, 3, 4, 9].map(reconnectDelay)).toEqual([1000, 2000, 5000, 10000, 10000, 10000]);
  });
});

describe("safeNext", () => {
  it("só aceita caminho interno", () => {
    expect(safeNext("/batches/123")).toBe("/batches/123");
    expect(safeNext("//evil.com")).toBe("/batches");
    expect(safeNext("https://evil.com")).toBe("/batches");
    expect(safeNext(null)).toBe("/batches");
  });
});
