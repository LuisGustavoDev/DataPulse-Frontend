import type { Column } from "./header";

// §5.3 Regras por coluna. Cada registro inválido gera uma anomalia com o primeiro erro:
// estrutura primeiro, depois as colunas na ordem de REQUIRED_COLUMNS.

export const TX_STATUSES = ["aprovada", "pendente", "cancelada", "estornada"] as const;
export type TxStatus = (typeof TX_STATUSES)[number];

export const MIN_DATE = "1990-01-01";
export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

type Check<T> = { ok: true; value: T } | { ok: false; code: string };

/** Hoje no fuso de negócio, como YYYY-MM-DD. */
export function todayInBusinessTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(now);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isRealDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** YYYY-MM-DD ou DD/MM/YYYY, entre 1990-01-01 e hoje + 1 dia (P6). */
export function checkDate(value: string, today: string = todayInBusinessTz()): Check<string> {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const parts = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : null;
  if (!parts) return { ok: false, code: "INVALID_DATE_FORMAT" };

  const [y, m, d] = parts.map(Number) as [number, number, number];
  if (!isRealDate(y, m, d)) return { ok: false, code: "INVALID_DATE_FORMAT" };

  const normalized = `${parts[0]}-${parts[1]}-${parts[2]}`;
  if (normalized < MIN_DATE || normalized > addDays(today, 1)) return { ok: false, code: "DATE_OUT_OF_RANGE" };
  return { ok: true, value: normalized };
}

/**
 * Ponto ou vírgula decimal, até 2 casas, sem separador de milhar. Negativo e zero valem
 * (P3). Devolve a string normalizada com ponto, pronta para numeric(14,2).
 */
export function checkAmount(value: string): Check<string> {
  const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(value);
  if (!match) return { ok: false, code: "INVALID_AMOUNT" };

  const [, sign = "", intPart = "", frac = ""] = match;
  const integer = intPart.replace(/^0+(?=\d)/, "");
  if (integer.length > 12) return { ok: false, code: "AMOUNT_OUT_OF_RANGE" };
  return { ok: true, value: `${sign}${integer}.${frac.padEnd(2, "0")}` };
}

const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function checkId(value: string, code: "INVALID_CLIENT_ID" | "INVALID_PRODUCT_ID"): Check<string> {
  return ID_PATTERN.test(value) ? { ok: true, value } : { ok: false, code };
}

/** Sem distinção de maiúsculas e acentos; grava em minúsculas e sem acento. */
export function checkStatus(value: string): Check<TxStatus> {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return (TX_STATUSES as readonly string[]).includes(normalized)
    ? { ok: true, value: normalized as TxStatus }
    : { ok: false, code: "INVALID_STATUS" };
}

export type ValidRow = {
  tx_date: string;
  amount: string;
  client_id: string;
  product_id: string;
  status: TxStatus;
};

export type RowCheck = { ok: true; row: ValidRow } | { ok: false; code: string; column: Column | null };

/** Valida um registro já separado em campos, mapeando as colunas pela ordem do cabeçalho. */
export function checkRow(fields: readonly string[], columnOrder: readonly Column[], today?: string): RowCheck {
  if (fields.length !== columnOrder.length) return { ok: false, code: "COLUMN_COUNT_MISMATCH", column: null };

  const byName = new Map(columnOrder.map((c, i) => [c, fields[i] ?? ""]));
  const get = (c: Column) => byName.get(c) ?? "";

  for (const column of ["data", "valor", "cliente_id", "produto_id", "status"] as const) {
    if (get(column) === "") return { ok: false, code: "MISSING_REQUIRED_FIELD", column };
  }

  const date = checkDate(get("data"), today);
  if (!date.ok) return { ok: false, code: date.code, column: "data" };
  const amount = checkAmount(get("valor"));
  if (!amount.ok) return { ok: false, code: amount.code, column: "valor" };
  const client = checkId(get("cliente_id"), "INVALID_CLIENT_ID");
  if (!client.ok) return { ok: false, code: client.code, column: "cliente_id" };
  const product = checkId(get("produto_id"), "INVALID_PRODUCT_ID");
  if (!product.ok) return { ok: false, code: product.code, column: "produto_id" };
  const status = checkStatus(get("status"));
  if (!status.ok) return { ok: false, code: status.code, column: "status" };

  return {
    ok: true,
    row: {
      tx_date: date.value,
      amount: amount.value,
      client_id: client.value,
      product_id: product.value,
      status: status.value,
    },
  };
}
