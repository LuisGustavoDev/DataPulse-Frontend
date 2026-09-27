import type { Metadata } from "next";
import { Suspense } from "react";
import { BatchDetailView } from "@/features/batches/components/batch-detail-view";

export const metadata: Metadata = { title: "Lote" };

// Só o id da URL passa pelo servidor; os dados do lote vêm da API no navegador (ADR 18).
export default async function BatchPage({ params }: PageProps<"/batches/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <BatchDetailView id={id} />
    </Suspense>
  );
}
