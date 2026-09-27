// §5.2 Cabeçalho: exatamente as 5 colunas, em qualquer ordem, sem distinção de
// maiúsculas e espaços.

export const REQUIRED_COLUMNS = ["data", "valor", "cliente_id", "produto_id", "status"] as const;
export type Column = (typeof REQUIRED_COLUMNS)[number];

export const normalizeColumnName = (name: string) => name.replace(/\s+/g, "").toLowerCase();

export type HeaderCheck =
  | { ok: true; columnOrder: Column[] }
  | { ok: false; missing: string[]; unexpected: string[]; duplicated: string[] };

export function validateHeader(fields: readonly string[]): HeaderCheck {
  const required = new Set<string>(REQUIRED_COLUMNS);
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  const unexpected: string[] = [];

  for (const raw of fields) {
    const name = normalizeColumnName(raw);
    if (seen.has(name)) duplicated.add(name);
    seen.add(name);
    if (!required.has(name)) unexpected.push(name);
  }

  const missing = REQUIRED_COLUMNS.filter((c) => !seen.has(c));

  if (missing.length === 0 && unexpected.length === 0 && duplicated.size === 0) {
    return { ok: true, columnOrder: fields.map(normalizeColumnName) as Column[] };
  }
  return { ok: false, missing, unexpected, duplicated: [...duplicated] };
}
