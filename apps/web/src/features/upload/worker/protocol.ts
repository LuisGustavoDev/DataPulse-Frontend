import type { PartUrl } from "@datapulse/contracts";
import type { SampleInspection } from "@datapulse/csv-rules";

// Mensagens entre a página e o upload.worker. Tipadas dos dois lados para o TypeScript
// pegar qualquer divergência.

export type ToWorker =
  /** Inspeciona os primeiros 64 KiB e, se o cabeçalho passar, calcula o SHA-256. */
  | { type: "prepare"; file: File }
  | {
      type: "upload";
      file: File;
      partSize: number;
      /** Só as partes que faltam, com URL assinada. */
      parts: PartUrl[];
      concurrency: number;
    }
  /** Resposta a `need-urls`: URLs renovadas depois de um 403 do MinIO (U3). */
  | { type: "urls"; parts: PartUrl[] }
  | { type: "cancel" };

export type FromWorker =
  | { type: "inspected"; result: SampleInspection }
  | { type: "hash-progress"; bytes: number }
  | { type: "hashed"; sha256: string }
  | { type: "part-progress"; partNumber: number; loaded: number }
  | { type: "part-done"; partNumber: number; etag: string; size: number }
  | { type: "need-urls"; partNumbers: number[] }
  | { type: "upload-done" }
  | { type: "error"; code: WorkerErrorCode; message: string };

export type WorkerErrorCode = "READ_FAILED" | "PART_FAILED" | "NO_ETAG" | "CANCELLED";

/** Faixa de bytes da parte N (1-based). A última parte pode ser menor. */
export function partRange(partNumber: number, partSize: number, fileSize: number): [number, number] {
  const start = (partNumber - 1) * partSize;
  return [start, Math.min(start + partSize, fileSize)];
}

export const partCount = (fileSize: number, partSize: number) => Math.max(1, Math.ceil(fileSize / partSize));
