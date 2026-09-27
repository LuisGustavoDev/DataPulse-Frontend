import {
  MAX_RECORD_BYTES,
  decodeSample,
  detectDelimiter,
  detectEncoding,
  isCompressed,
  looksBinary,
  readFirstRecord,
  splitRecord,
  type Delimiter,
  type Encoding,
} from "./dialect";
import { validateHeader, type Column } from "./header";

export type SampleInspection =
  | { ok: true; encoding: Encoding; delimiter: Delimiter; columnOrder: Column[] }
  | { ok: false; code: "UNSUPPORTED_FORMAT"; detail: string }
  | { ok: false; code: "DELIMITER_UNDETECTED"; detail: string }
  | {
      ok: false;
      code: "SCHEMA_MISMATCH";
      detail: string;
      missing: string[];
      unexpected: string[];
      duplicated: string[];
    };

/**
 * A mesma checagem síncrona que a API faz em POST /batches/{id}/complete (ADR 04), aqui
 * sobre os primeiros 64 KiB do arquivo. `isWholeFile` indica que a amostra é o arquivo
 * inteiro, e então um cabeçalho sem quebra de linha no fim é válido.
 */
export function inspectSample(bytes: Uint8Array, isWholeFile: boolean): SampleInspection {
  if (isCompressed(bytes)) {
    return { ok: false, code: "UNSUPPORTED_FORMAT", detail: "Arquivos compactados (.gz, .zip) não são aceitos." };
  }
  if (looksBinary(bytes)) {
    return { ok: false, code: "UNSUPPORTED_FORMAT", detail: "O arquivo não parece ser um CSV de texto." };
  }

  const encoding = detectEncoding(bytes);
  const text = decodeSample(bytes, encoding);
  const header = readFirstRecord(text) ?? (isWholeFile ? text : null);

  if (header === null || new TextEncoder().encode(header).length > MAX_RECORD_BYTES) {
    return { ok: false, code: "SCHEMA_MISMATCH", detail: "Cabeçalho não encontrado ou maior que 8 KiB.", missing: [], unexpected: [], duplicated: [] };
  }

  const delimiter = detectDelimiter(header);
  if (!delimiter) {
    return {
      ok: false,
      code: "DELIMITER_UNDETECTED",
      detail: "O cabeçalho precisa usar só vírgula (,) ou só ponto e vírgula (;) como separador.",
    };
  }

  const split = splitRecord(header, delimiter);
  if (!split.ok) {
    return { ok: false, code: "SCHEMA_MISMATCH", detail: "Aspas malformadas no cabeçalho.", missing: [], unexpected: [], duplicated: [] };
  }

  const check = validateHeader(split.fields);
  if (!check.ok) {
    const { missing, unexpected, duplicated } = check;
    return { ok: false, code: "SCHEMA_MISMATCH", detail: describeMismatch(check), missing, unexpected, duplicated };
  }
  return { ok: true, encoding, delimiter, columnOrder: check.columnOrder };
}

function describeMismatch(c: { missing: string[]; unexpected: string[]; duplicated: string[] }): string {
  const parts: string[] = [];
  if (c.missing.length) parts.push(`Faltando: ${c.missing.join(", ")}.`);
  if (c.unexpected.length) parts.push(`Inesperada: ${c.unexpected.join(", ")}.`);
  if (c.duplicated.length) parts.push(`Duplicada: ${c.duplicated.join(", ")}.`);
  return parts.join(" ");
}
