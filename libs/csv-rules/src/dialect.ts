// §5.1 Dialeto: encoding, delimitador, aspas e compactação.

export type Encoding = "utf-8" | "windows-1252";
export type Delimiter = "," | ";";

/** A API e o frontend olham só os primeiros 64 KiB para detectar dialeto e cabeçalho. */
export const SAMPLE_BYTES = 64 * 1024;

/** Tamanho máximo de um registro, cabeçalho incluído. */
export const MAX_RECORD_BYTES = 8 * 1024;

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;

export function hasUtf8Bom(bytes: Uint8Array): boolean {
  return UTF8_BOM.every((b, i) => bytes[i] === b);
}

/** gzip (1F 8B) ou zip (PK\x03\x04, PK\x05\x06 vazio, PK\x07\x08 spanned). */
export function isCompressed(bytes: Uint8Array): boolean {
  const [b0, b1, b2, b3] = bytes;
  if (b0 === 0x1f && b1 === 0x8b) return true;
  return b0 === 0x50 && b1 === 0x4b && ((b2 === 0x03 && b3 === 0x04) || (b2 === 0x05 && b3 === 0x06) || (b2 === 0x07 && b3 === 0x08));
}

/** Byte NUL não aparece em texto UTF-8 nem Windows-1252: é binário renomeado para .csv. */
export function looksBinary(bytes: Uint8Array): boolean {
  return bytes.includes(0x00);
}

/**
 * UTF-8 se a amostra for UTF-8 válido; senão Windows-1252. `stream: true` evita acusar
 * erro num caractere multibyte cortado no fim da amostra.
 */
export function detectEncoding(bytes: Uint8Array): Encoding {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}

export function decodeSample(bytes: Uint8Array, encoding: Encoding): string {
  const body = encoding === "utf-8" && hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes;
  return new TextDecoder(encoding).decode(body, { stream: true });
}

/**
 * Primeiro registro do texto, respeitando aspas: uma quebra de linha entre aspas faz
 * parte do campo. Devolve null se o registro não termina dentro do texto.
 */
export function readFirstRecord(text: string): string | null {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) return text.slice(0, i);
  }
  return null;
}

/** Exatamente um dos dois delimitadores deve aparecer no cabeçalho, fora de aspas. */
export function detectDelimiter(headerLine: string): Delimiter | null {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ",") commas++;
    else if (!inQuotes && ch === ";") semicolons++;
  }
  if (commas > 0 && semicolons === 0) return ",";
  if (semicolons > 0 && commas === 0) return ";";
  return null;
}

export type SplitResult = { ok: true; fields: string[] } | { ok: false; code: "MALFORMED_QUOTES" };

/**
 * Separa um registro em campos (RFC 4180): `"` delimita campo, `""` é aspas literal e
 * todo campo passa por trim.
 */
export function splitRecord(record: string, delimiter: Delimiter): SplitResult {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoted = false;

  for (let i = 0; i < record.length; i++) {
    const ch = record[i];
    if (inQuotes) {
      if (ch === '"' && record[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.trim() === "" && !quoted) {
      inQuotes = true;
      quoted = true;
      field = "";
    } else if (ch === delimiter) {
      fields.push(field.trim());
      field = "";
      quoted = false;
    } else if (quoted && ch !== " " && ch !== "\t") {
      // Texto depois da aspa de fechamento: `"abc"x`
      return { ok: false, code: "MALFORMED_QUOTES" };
    } else {
      field += ch;
    }
  }

  if (inQuotes) return { ok: false, code: "MALFORMED_QUOTES" };
  fields.push(field.trim());
  return { ok: true, fields };
}
