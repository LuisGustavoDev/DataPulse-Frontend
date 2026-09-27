"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useSession } from "@/providers/session-provider";
import { safeNext } from "../use-auth-form";

type AuthCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Login e signup mandam quem já está logado direto para o app. */
  redirectIfAuthenticated?: boolean;
};

export function AuthCard({ title, description, children, redirectIfAuthenticated = false }: AuthCardProps) {
  const session = useSession();
  const router = useRouter();
  // Só redireciona quem chegou já logado (loading → authenticated). Quem acabou de
  // enviar o formulário (unauthenticated → authenticated) é redirecionado pelo próprio
  // formulário; redirecionar aqui também disputaria com ele e ignoraria o ?next=.
  const [sawLoggedOut, setSawLoggedOut] = useState(false);
  if (session.status === "unauthenticated" && !sawLoggedOut) setSawLoggedOut(true);
  const shouldRedirect = redirectIfAuthenticated && session.status === "authenticated" && !sawLoggedOut;

  useEffect(() => {
    if (shouldRedirect) router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, [shouldRedirect, router]);

  if (shouldRedirect || (redirectIfAuthenticated && session.status === "loading")) return <FullPageSpinner />;

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
