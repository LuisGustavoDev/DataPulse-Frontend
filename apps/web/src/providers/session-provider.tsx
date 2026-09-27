"use client";

import type { AuthSession, SessionUser, Tenant } from "@datapulse/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import {
  clearAccessToken,
  getTokenExpiresAt,
  onSessionExpired,
  refreshAccessToken,
  setAccessToken,
} from "@/lib/api/token-store";

/** Renova 60 s antes de expirar (§3.1). */
const REFRESH_AHEAD_MS = 60_000;

type SessionState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: SessionUser; tenant: Tenant };

type SessionContextValue = SessionState & {
  /** Grava a sessão devolvida por login, signup ou accept-invite. */
  startSession: (session: AuthSession) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endSession = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    clearAccessToken();
    // Dados do tenant não podem sobrar no cache para o próximo usuário da máquina.
    queryClient.clear();
    setState({ status: "unauthenticated" });
  }, [queryClient]);

  const scheduleRefresh = useCallback(() => {
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      const delay = Math.max(getTokenExpiresAt() - Date.now() - REFRESH_AHEAD_MS, 0);
      timer.current = setTimeout(() => {
        refreshAccessToken().then(schedule, (err) => {
          // Falha de rede não derruba a sessão: tenta de novo em 15 s.
          if (err instanceof ApiError && err.status === 0) timer.current = setTimeout(schedule, 15_000);
          else endSession();
        });
      }, delay);
    };
    schedule();
  }, [endSession]);

  // Ao abrir o app: tenta recuperar a sessão pelo cookie dp_rt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshAccessToken();
        const me = await authApi.me();
        if (cancelled) return;
        setState({ status: "authenticated", user: me.user, tenant: me.tenant });
        scheduleRefresh();
      } catch {
        if (!cancelled) setState({ status: "unauthenticated" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleRefresh]);

  useEffect(() => onSessionExpired(endSession), [endSession]);

  // Timers ficam congelados em aba de fundo: ao voltar, renova se o token já venceu.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || state.status !== "authenticated") return;
      if (getTokenExpiresAt() - Date.now() < REFRESH_AHEAD_MS) scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [scheduleRefresh, state.status]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const startSession = useCallback(
    (session: AuthSession) => {
      queryClient.clear();
      setAccessToken(session.access_token, session.expires_in);
      setState({ status: "authenticated", user: session.user, tenant: session.tenant });
      scheduleRefresh();
    },
    [queryClient, scheduleRefresh],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo(() => ({ ...state, startSession, logout }), [state, startSession, logout]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return ctx;
}

/** Para telas autenticadas: o layout de (app) só as renderiza com sessão ativa. */
export function useAuthenticatedSession() {
  const session = useSession();
  if (session.status !== "authenticated") throw new Error("Sessão ausente");
  return session;
}
