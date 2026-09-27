import type { Metadata } from "next";
import { Suspense } from "react";
import { BatchListView } from "@/features/batches/components/batch-list-view";

export const metadata: Metadata = { title: "Lotes" };

export default function BatchesPage() {
  return (
    <Suspense>
      <BatchListView />
    </Suspense>
  );
}
