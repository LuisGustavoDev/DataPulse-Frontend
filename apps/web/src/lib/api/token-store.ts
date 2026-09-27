import { RefreshResponse } from "@datapulse/contracts";
import { ApiError } from "./errors";

// Access token só em memória (§3.1): some ao fechar a aba e nunca vai para storage, onde
// um XSS conseguiria ler. A sessão sobrevive pelo cookie dp_rt, que o JS não enxerga.

let accessToken: string | null = null;
let expiresAt = 0;
let inflight: Promise<string> | null = null;
const expiredListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

/** Instante (ms) em que o token atual expira; 0 sem sessão. */
export function getTokenExpiresAt(): number {
  return expiresAt;
}

export function setAccessToken(token: string, expiresInSeconds: number): void {
  accessToken = token;
  expiresAt = Date.now() + expiresInSeconds * 1000;
}

export function clearAccessToken(): void {
  accessToken = null;
  expiresAt = 0;
}

/** Avisado quando o refresh falha: a sessão acabou e a UI precisa voltar ao login. */
export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function notifySessionExpired(): void {
  clearAccessToken();
  for (const listener of expiredListeners) listener();
}

/**
 * Troca o cookie dp_rt por um access token novo. O refresh token é rotacionado a cada
 * uso e reuso revoga a família inteira (§11.2), então duas chamadas concorrentes com o
 * mesmo cookie derrubariam a sessão. Por isso:
 * - na mesma aba, chamadas simultâneas compartilham a mesma promise;
 * - entre abas, a Web Locks API serializa o refresh, e quem espera recebe o cookie já
 *   rotacionado.
 */
export function refreshAccessToken(): Promise<string> {
  inflight ??= withCrossTabLock(doRefresh).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(): Promise<string> {
  // Outra aba pode ter acabado de renovar enquanto esperávamos o lock; mesmo assim cada
  // aba precisa do próprio access token, porque ele só existe em memória.
  let res: Response;
  try {
    res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor.");
  }
  if (!res.ok) {
    clearAccessToken();
    throw new ApiError(res.status, "REFRESH_INVALID", "Sessão expirada. Faça login de novo.");
  }
  const body = RefreshResponse.parse(await res.json());
  setAccessToken(body.access_token, body.expires_in);
  return body.access_token;
}

function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return navigator.locks.request("datapulse-refresh", fn) as Promise<T>;
  }
  return fn();
}
