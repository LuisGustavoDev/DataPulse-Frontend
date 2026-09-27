import type { z } from "zod";
import { ApiError } from "./errors";
import { getAccessToken, notifySessionExpired, refreshAccessToken } from "./token-store";

const API_PREFIX = "/api/v1";

type QueryValue = string | number | boolean | null | undefined | readonly string[];

type ApiFetchOptions<S extends z.ZodType> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  schema?: S;
  signal?: AbortSignal;
  /** false para login, signup e accept-invite, que não levam Bearer. */
  auth?: boolean;
};

export async function apiFetch<S extends z.ZodType>(
  path: string,
  opts: ApiFetchOptions<S> = {},
): Promise<z.infer<S>> {
  const auth = opts.auth ?? true;
  let res = await send(path, opts, auth ? getAccessToken() : null);

  // Token expirado entre o refresh agendado e a requisição: renova uma vez e repete.
  if (res.status === 401 && auth) {
    let token: string;
    try {
      token = await refreshAccessToken();
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) notifySessionExpired();
      throw err;
    }
    res = await send(path, opts, token);
    if (res.status === 401) notifySessionExpired();
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as z.infer<S>;

  // 202 de retry e DELETE podem vir sem corpo.
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  return opts.schema ? opts.schema.parse(data) : (data as z.infer<S>);
}

async function send<S extends z.ZodType>(
  path: string,
  opts: ApiFetchOptions<S>,
  token: string | null,
): Promise<Response> {
  const headers = new Headers();
  if (opts.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    return await fetch(`${API_PREFIX}${path}${toQueryString(opts.query)}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    // Cancelamento pelo TanStack Query não é falha: repassa o erro original.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor.");
  }
}

export function toQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// Aceita RFC 7807 (§8.1), o formato que a API usa hoje ({ code, message, errors }), o
// padrão do NestJS ({ statusCode, message }) e corpos que nem são JSON, como o HTML de
// um 502 do ingress.
export async function toApiError(res: Response): Promise<ApiError> {
  const headerTraceId = res.headers.get("X-Trace-Id") ?? undefined;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }

  const record = isRecord(body) ? body : {};
  const rawMessage = record.message;
  const message =
    asString(record.detail) ??
    (Array.isArray(rawMessage) ? rawMessage.filter((m) => typeof m === "string").join("; ") : asString(rawMessage)) ??
    asString(record.title) ??
    defaultMessage(res.status);

  return new ApiError(
    res.status,
    asString(record.code) ?? `HTTP_${res.status}`,
    message || defaultMessage(res.status),
    asString(record.trace_id) ?? headerTraceId,
    record.errors,
  );
}

function defaultMessage(status: number): string {
  if (status === 401) return "Sua sessão expirou. Faça login de novo.";
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Não encontrado.";
  if (status === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (status >= 500) return "O servidor não conseguiu responder. Tente de novo em instantes.";
  return `Erro ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
