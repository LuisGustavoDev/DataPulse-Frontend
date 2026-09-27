"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useRealtimeState } from "@/providers/realtime-provider";
import { useAuthenticatedSession } from "@/providers/session-provider";
import { Logo } from "./logo";

const NAV = [
  { href: "/batches", label: "Lotes", match: (p: string) => p === "/batches" || /^\/batches\/(?!new)/.test(p) },
  { href: "/batches/new", label: "Novo upload", match: (p: string) => p === "/batches/new" },
  { href: "/dashboard", label: "Dashboard", match: (p: string) => p.startsWith("/dashboard") },
  { href: "/settings/users", label: "Usuários", match: (p: string) => p.startsWith("/settings"), adminOnly: true },
];

const REALTIME_LABEL = {
  open: { label: "Tempo real ativo", dot: "bg-success" },
  connecting: { label: "Conectando…", dot: "bg-warning" },
  reconnecting: { label: "Reconectando…", dot: "bg-warning animate-pulse" },
  closed: { label: "Tempo real desligado", dot: "bg-muted" },
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, tenant, logout } = useAuthenticatedSession();
  const pathname = usePathname();
  const realtime = REALTIME_LABEL[useRealtimeState()];
  const [loggingOut, setLoggingOut] = useState(false);

  const items = NAV.filter((item) => !item.adminOnly || user.role === "admin");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-surface focus:p-2">
        Pular para o conteúdo
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/batches" aria-label="DataPulse, ir para os lotes">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="order-last w-full overflow-x-auto sm:order-none sm:w-auto">
            <ul className="flex gap-1">
              {items.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
                        active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden items-center gap-1.5 text-xs text-muted md:inline-flex" title={realtime.label}>
              <span aria-hidden className={cn("size-2 rounded-full", realtime.dot)} />
              {realtime.label}
            </span>
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-medium">{tenant.name}</p>
              <p className="text-xs text-muted">
                {user.email} · {user.role === "admin" ? "Administrador" : "Analista"}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-60"
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true);
                void logout();
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
