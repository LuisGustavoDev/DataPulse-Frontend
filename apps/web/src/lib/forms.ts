import type { z } from "zod";

/** Primeiro erro de cada campo de um safeParse do zod. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    out[field] ??= issue.message;
  }
  return out;
}

/** Lê os campos de texto de um <form> como objeto. */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new FormData(form)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
