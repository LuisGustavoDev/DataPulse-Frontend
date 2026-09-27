import type { z } from "zod";
import { ApiError } from "./errors";

const API_PREFIX = "/api/v1";

type ApiFetchOptions<S extends z.ZodType> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: S;
  signal?: AbortSignal;
};

export async function apiFetch<S extends z.ZodType>(
  path: string,
  opts: ApiFetchOptions<S> = {},
): Promise<z.infer<S>> {
  const hasBody = opts.body !== undefined;

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      method: opts.method ?? "GET",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    // Cancelamento pelo TanStack Query não é falha: repassa o erro original.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor.");
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as z.infer<S>;

  const data: unknown = await res.json();
  return opts.schema ? opts.schema.parse(data) : (data as z.infer<S>);
}

// Aceita RFC 7807 (§8.1), o formato padrão do NestJS ({ statusCode, message }) e corpos
// que nem são JSON, como o HTML de um 502 do ingress.
async function toApiError(res: Response): Promise<ApiError> {
  const headerTraceId = res.headers.get("X-Trace-Id") ?? undefined;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }

  if (isRecord(body) && typeof body.code === "string") {
    const message = asString(body.detail) ?? asString(body.title) ?? res.statusText;
    return new ApiError(
      res.status,
      body.code,
      message,
      asString(body.trace_id) ?? headerTraceId,
      isRecord(body.errors) ? body.errors : undefined,
    );
  }

  // NestJS manda message como string ou, em erros de validação, como lista.
  const nestMessage = isRecord(body) ? body.message : undefined;
  const message = Array.isArray(nestMessage)
    ? nestMessage.filter((m) => typeof m === "string").join("; ")
    : (asString(nestMessage) ?? res.statusText);

  return new ApiError(res.status, `HTTP_${res.status}`, message || `Erro ${res.status}`, headerTraceId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
