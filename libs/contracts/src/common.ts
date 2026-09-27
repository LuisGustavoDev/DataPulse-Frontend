import { z } from "zod";

// Convenções do §8.1: JSON em snake_case, timestamps ISO 8601 UTC, datas YYYY-MM-DD e
// dinheiro como string decimal, nunca float.

export const Uuid = z.uuid();

export const IsoDateTime = z.iso.datetime({ offset: true });

export const IsoDate = z.iso.date();

/** Valor monetário em BRL como string decimal: "1234.56", "-10.00". */
export const Decimal = z.string().regex(/^-?\d+(\.\d+)?$/, "Valor decimal inválido");
export type Decimal = z.infer<typeof Decimal>;

/** Contagens vêm de colunas bigint e podem chegar como string; normaliza para number. */
export const Count = z.coerce.number().int().nonnegative();

/** Resposta paginada por cursor opaco (§8.1). `next_cursor` é null na última página. */
export function page<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
  });
}
