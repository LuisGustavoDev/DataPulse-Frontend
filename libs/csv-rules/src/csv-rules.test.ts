import { describe, expect, it } from "vitest";
import {
  checkAmount,
  checkDate,
  checkRow,
  checkStatus,
  detectDelimiter,
  detectEncoding,
  inspectSample,
  splitRecord,
  todayInBusinessTz,
  validateHeader,
} from "./index";

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Codifica em Windows-1252 os caracteres usados nos testes (Latin-1 coincide aqui). */
const cp1252 = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));

describe("inspectSample (§5.1, §5.2)", () => {
  it("aceita exportação do Excel brasileiro: ;, vírgula decimal, Windows-1252", () => {
    const bytes = cp1252("Data;Valor;Cliente_ID;Produto_ID;Status\r\n01/08/2026;129,90;C-1;P-1;Aprovada\r\n");
    const result = inspectSample(bytes, true);
    expect(result).toEqual({
      ok: true,
      encoding: "utf-8",
      delimiter: ";",
      columnOrder: ["data", "valor", "cliente_id", "produto_id", "status"],
    });
  });

  it("detecta Windows-1252 quando há acento fora do UTF-8", () => {
    const bytes = cp1252("data;valor;cliente_id;produto_id;status\n2026-08-01;1,00;C;P;não\n");
    const result = inspectSample(bytes, true);
    expect(result.ok && result.encoding).toBe("windows-1252");
  });

  it("ignora o BOM do UTF-8", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("data,valor,cliente_id,produto_id,status\n")]);
    expect(inspectSample(bytes, true).ok).toBe(true);
  });

  it("aceita colunas em qualquer ordem, com espaços e maiúsculas", () => {
    const result = inspectSample(utf8(" STATUS , produto_id,cliente_id,Valor,data\n"), false);
    expect(result.ok && result.columnOrder).toEqual(["status", "produto_id", "cliente_id", "valor", "data"]);
  });

  it("rejeita a coluna extra categoria com a lista de diferenças", () => {
    const result = inspectSample(utf8("data,valor,cliente_id,produto_id,status,categoria\n"), false);
    expect(result).toMatchObject({ ok: false, code: "SCHEMA_MISMATCH", unexpected: ["categoria"], missing: [] });
  });

  it("aponta coluna faltando e duplicada", () => {
    const result = inspectSample(utf8("data,data,valor,cliente_id,status\n"), false);
    expect(result).toMatchObject({ code: "SCHEMA_MISMATCH", missing: ["produto_id"], duplicated: ["data"] });
  });

  it("rejeita gzip, zip e binário", () => {
    expect(inspectSample(new Uint8Array([0x1f, 0x8b, 0x08, 0x00]), false)).toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    expect(inspectSample(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), false)).toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    expect(inspectSample(utf8("data\u0000valor"), false)).toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("rejeita cabeçalho com os dois delimitadores ou nenhum", () => {
    expect(inspectSample(utf8("data,valor;cliente_id\n"), false)).toMatchObject({ code: "DELIMITER_UNDETECTED" });
    expect(inspectSample(utf8("data\n"), false)).toMatchObject({ code: "DELIMITER_UNDETECTED" });
  });

  it("exige quebra de linha no cabeçalho quando a amostra não é o arquivo todo", () => {
    expect(inspectSample(utf8("data,valor,cliente_id,produto_id,status"), false)).toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
    expect(inspectSample(utf8("data,valor,cliente_id,produto_id,status"), true).ok).toBe(true);
  });
});

describe("tokenização", () => {
  it("respeita aspas, aspas duplas e delimitador dentro de aspas", () => {
    expect(splitRecord('a;"b;c";"d ""e"""', ";")).toEqual({ ok: true, fields: ["a", "b;c", 'd "e"'] });
  });

  it("acusa aspas não fechadas e texto após a aspa de fechamento", () => {
    expect(splitRecord('a,"b', ",")).toEqual({ ok: false, code: "MALFORMED_QUOTES" });
    expect(splitRecord('a,"b"x', ",")).toEqual({ ok: false, code: "MALFORMED_QUOTES" });
  });

  it("não conta delimitador entre aspas na detecção", () => {
    expect(detectDelimiter('"a,b";c')).toBe(";");
  });

  it("não acusa Windows-1252 por um caractere multibyte cortado no fim da amostra", () => {
    const bytes = utf8("ação");
    expect(detectEncoding(bytes.subarray(0, bytes.length - 1))).toBe("utf-8");
  });

  it("validateHeader devolve a ordem das colunas", () => {
    expect(validateHeader(["valor", "data", "status", "produto_id", "cliente_id"])).toMatchObject({ ok: true });
  });
});

describe("regras por coluna (§5.3)", () => {
  const today = "2026-09-27";

  it("data: dois formatos, data real e faixa até hoje + 1", () => {
    expect(checkDate("31/08/2026", today)).toEqual({ ok: true, value: "2026-08-31" });
    expect(checkDate("2026-09-28", today).ok).toBe(true);
    expect(checkDate("2026-09-29", today)).toEqual({ ok: false, code: "DATE_OUT_OF_RANGE" });
    expect(checkDate("1989-12-31", today)).toEqual({ ok: false, code: "DATE_OUT_OF_RANGE" });
    expect(checkDate("31/02/2026", today)).toEqual({ ok: false, code: "INVALID_DATE_FORMAT" });
    expect(checkDate("2026/08/01", today)).toEqual({ ok: false, code: "INVALID_DATE_FORMAT" });
  });

  it("valor: ponto ou vírgula, negativo e zero, sem milhar", () => {
    expect(checkAmount("1234,5")).toEqual({ ok: true, value: "1234.50" });
    expect(checkAmount("-0.01")).toEqual({ ok: true, value: "-0.01" });
    expect(checkAmount("0")).toEqual({ ok: true, value: "0.00" });
    expect(checkAmount("999999999999.99").ok).toBe(true);
    expect(checkAmount("1000000000000")).toEqual({ ok: false, code: "AMOUNT_OUT_OF_RANGE" });
    expect(checkAmount("1.234,56")).toEqual({ ok: false, code: "INVALID_AMOUNT" });
    expect(checkAmount("1.234")).toEqual({ ok: false, code: "INVALID_AMOUNT" });
  });

  it("status: sem distinção de maiúsculas e acentos", () => {
    expect(checkStatus("APROVADA")).toEqual({ ok: true, value: "aprovada" });
    expect(checkStatus("Cancelada")).toEqual({ ok: true, value: "cancelada" });
    expect(checkStatus("paga")).toEqual({ ok: false, code: "INVALID_STATUS" });
  });

  it("registro: estrutura primeiro, depois colunas na ordem da tabela", () => {
    const order = ["data", "valor", "cliente_id", "produto_id", "status"] as const;
    expect(checkRow(["a", "b"], order, today)).toMatchObject({ code: "COLUMN_COUNT_MISMATCH" });
    expect(checkRow(["xx", "", "C", "P", "ok"], order, today)).toMatchObject({
      code: "MISSING_REQUIRED_FIELD",
      column: "valor",
    });
    expect(checkRow(["xx", "1", "C", "P", "ruim"], order, today)).toMatchObject({ code: "INVALID_DATE_FORMAT" });
    expect(checkRow(["2026-08-01", "1,5", "C 1", "P", "aprovada"], order, today)).toMatchObject({
      code: "INVALID_CLIENT_ID",
    });
    expect(checkRow(["2026-08-01", "1,5", "C-1", "P-1", "Estornada"], order, today)).toEqual({
      ok: true,
      row: { tx_date: "2026-08-01", amount: "1.50", client_id: "C-1", product_id: "P-1", status: "estornada" },
    });
  });

  it("hoje é calculado no fuso America/Sao_Paulo", () => {
    // 02:00 UTC do dia 28 ainda é dia 27 em São Paulo (UTC-3)
    expect(todayInBusinessTz(new Date("2026-09-28T02:00:00Z"))).toBe("2026-09-27");
  });
});
