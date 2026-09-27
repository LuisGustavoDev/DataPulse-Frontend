import type { Metadata } from "next";
import { UploadView } from "@/features/upload/components/upload-view";

export const metadata: Metadata = { title: "Novo upload" };

export default function NewBatchPage() {
  return <UploadView />;
}
