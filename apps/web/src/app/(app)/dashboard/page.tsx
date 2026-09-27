import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/card";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Consolidado de todos os lotes concluídos (inclusive os parciais) da sua empresa."
      />
      <Suspense>
        <DashboardView />
      </Suspense>
    </>
  );
}
