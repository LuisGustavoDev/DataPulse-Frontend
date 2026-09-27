"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { FullPageSpinner } from "@/components/ui/spinner";
import { RealtimeProvider } from "@/providers/realtime-provider";
import { useSession } from "@/providers/session-provider";

/**
 * Tudo que exige sessão. A guarda é no cliente: o cookie dp_rt tem Path=/api/v1/auth,
 * então o navegador não o manda nas rotas de página e um proxy.ts do Next não teria
 * como vê-lo. Segurança de verdade é o Bearer em cada chamada à API.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.status, router, pathname]);

  if (session.status !== "authenticated") return <FullPageSpinner label="Verificando sessão…" />;

  return (
    <RealtimeProvider>
      <AppShell>{children}</AppShell>
    </RealtimeProvider>
  );
}
