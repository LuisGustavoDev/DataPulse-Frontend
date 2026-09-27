// Todo erro que sai da camada HTTP vira ApiError, inclusive falha de rede (status 0).
// Assim a UI e o retry do TanStack Query checam um único tipo.
export class ApiError extends Error {
  constructor(
    readonly status: number, // 0 = falha de rede, sem resposta
    readonly code: string, // "SCHEMA_MISMATCH", "INVALID_CREDENTIALS"...
    message: string,
    readonly traceId?: string,
    readonly errors?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}
