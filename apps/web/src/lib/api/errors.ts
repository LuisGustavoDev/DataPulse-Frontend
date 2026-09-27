// Todo erro que sai da camada HTTP vira ApiError, inclusive falha de rede (status 0).
// Assim a UI e o retry do TanStack Query checam um único tipo.
export class ApiError extends Error {
  constructor(
    readonly status: number, // 0 = falha de rede, sem resposta
    readonly code: string, // "SCHEMA_MISMATCH", "INVALID_CREDENTIALS"...
    message: string,
    readonly traceId?: string,
    // RFC 7807 manda um objeto (§8.1); o ZodValidationPipe da API manda [{ field, message }]
    readonly errors?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export const isApiError = (err: unknown, code?: string): err is ApiError =>
  err instanceof ApiError && (code === undefined || err.code === code);

const MAX_RETRIES = 2;

/**
 * Retry das queries: só falha de rede (status 0) e 5xx mudam entre tentativas. 4xx,
 * resposta fora do contrato (ZodError) e JSON inválido falhariam igual de novo.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES || !(error instanceof ApiError)) return false;
  return error.status === 0 || error.status >= 500;
}

/** Mensagem para mostrar na UI, com o trace id quando é erro do servidor. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Algo deu errado. Tente de novo.";
  if (err.status >= 500 && err.traceId) return `${err.message} (código de rastreio: ${err.traceId})`;
  return err.message;
}

/** Erros por campo de um 400 VALIDATION_ERROR, nos dois formatos que a API usa. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_ERROR") return {};
  const out: Record<string, string> = {};
  if (Array.isArray(err.errors)) {
    for (const item of err.errors) {
      if (typeof item?.field === "string" && typeof item?.message === "string") out[item.field] ??= item.message;
    }
  } else if (typeof err.errors === "object" && err.errors !== null) {
    for (const [field, value] of Object.entries(err.errors)) {
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") out[field] = message;
    }
  }
  return out;
}
