"use client";

import { MAX_FILE_BYTES, MAX_FILENAME_LENGTH, type CompleteBody, type PartUrl } from "@datapulse/contracts";
import type { SampleInspection } from "@datapulse/csv-rules";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { batchesApi } from "@/features/batches/api";
import { ApiError, isApiError } from "@/lib/api/errors";
import { qk } from "@/lib/api/query-keys";
import { useAuthenticatedSession } from "@/providers/session-provider";
import { resumeStore, type PendingUpload } from "./resume-store";
import { createUploadWorker } from "./worker/create-worker";
import { partCount, type FromWorker, type ToWorker } from "./worker/protocol";

const CONCURRENCY = 4;

/** 4xx que vale retomar; os demais recusam o arquivo de vez. */
const RETRYABLE_CODES = new Set(["UPLOAD_INCOMPLETE", "RATE_LIMITED", "INVALID_STATE", "UNAUTHENTICATED"]);

type FailedInspection = Extract<SampleInspection, { ok: false }>;

export type UploadState =
  | { phase: "idle" }
  | { phase: "inspecting"; file: File }
  | { phase: "invalid"; file: File; reason: FailedInspection | { code: "LOCAL"; detail: string } }
  | { phase: "hashing"; file: File; bytes: number }
  | { phase: "creating"; file: File }
  | { phase: "duplicate"; file: File; sha256: string; existingBatchId: string | null }
  | { phase: "uploading"; file: File; batchId: string; sent: number; resumed: boolean }
  | { phase: "completing"; file: File; batchId: string }
  | { phase: "done"; batchId: string }
  | { phase: "rejected"; file: File; error: ApiError }
  | { phase: "failed"; file: File; message: string; retryable: boolean };

/** Checagens baratas antes de ler o arquivo. */
function localCheck(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "O arquivo precisa ter a extensão .csv.";
  if (file.name.length > MAX_FILENAME_LENGTH) return "O nome do arquivo passa de 255 caracteres.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_FILE_BYTES) return "O arquivo passa do limite de 1 GiB.";
  return null;
}

/**
 * Orquestra o fluxo do §3 (passos 1 a 3): inspeção e SHA-256 no worker, POST /batches,
 * envio das partes direto ao MinIO, retomada pelo IndexedDB e POST /complete. A API e o
 * token ficam aqui; o worker só lê o arquivo e faz os PUTs.
 */
export function useUpload() {
  const { user } = useAuthenticatedSession();
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const worker = useRef<Worker | null>(null);
  const current = useRef<{ batchId: string | null; cancelled: boolean }>({ batchId: null, cancelled: false });
  // Retomar o mesmo arquivo depois de uma falha não recalcula o SHA-256 de 1 GiB.
  const lastHash = useRef<{ file: File; sha256: string } | null>(null);

  const getWorker = () => {
    worker.current ??= createUploadWorker();
    return worker.current;
  };
  const send = (msg: ToWorker) => getWorker().postMessage(msg);

  useEffect(() => () => worker.current?.terminate(), []);

  // Fechar a aba no meio do envio não perde o que já subiu (U2), mas vale avisar.
  const busy = state.phase === "hashing" || state.phase === "uploading" || state.phase === "completing";
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  /** Inspeção e hash no worker. Resolve com o SHA-256, ou null se o cabeçalho falhou. */
  const prepare = (file: File) =>
    new Promise<string | null>((resolve, reject) => {
      getWorker().onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        if (msg.type === "inspected") {
          if (msg.result.ok) setState({ phase: "hashing", file, bytes: 0 });
          else {
            setState({ phase: "invalid", file, reason: msg.result });
            resolve(null);
          }
        } else if (msg.type === "hash-progress") {
          setState({ phase: "hashing", file, bytes: msg.bytes });
        } else if (msg.type === "hashed") {
          resolve(msg.sha256);
        } else if (msg.type === "error") {
          reject(new Error(msg.message));
        }
      };
      setState({ phase: "inspecting", file });
      send({ type: "prepare", file });
    });

  /** Envia as partes que faltam; `done` já traz as ETags confirmadas pelo servidor. */
  const uploadParts = (file: File, batchId: string, partSize: number, parts: PartUrl[], done: Map<number, string>, resumed: boolean) =>
    new Promise<Map<number, string>>((resolve, reject) => {
      const etags = new Map(done);
      const sizeOf = (n: number) => Math.min(partSize, file.size - (n - 1) * partSize);
      let confirmed = [...etags.keys()].reduce((sum, n) => sum + sizeOf(n), 0);
      const inflight = new Map<number, number>();
      const report = () => {
        const sending = [...inflight.values()].reduce((a, b) => a + b, 0);
        setState({ phase: "uploading", file, batchId, sent: Math.min(confirmed + sending, file.size), resumed });
      };
      report();

      if (parts.length === 0) return resolve(etags);

      getWorker().onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        switch (msg.type) {
          case "part-progress":
            inflight.set(msg.partNumber, msg.loaded);
            report();
            break;
          case "part-done":
            inflight.delete(msg.partNumber);
            etags.set(msg.partNumber, msg.etag);
            confirmed += msg.size;
            void resumeStore.markPart(batchId, msg.partNumber, msg.etag);
            report();
            break;
          case "need-urls":
            batchesApi
              .renewParts(batchId, msg.partNumbers)
              .then((r) => send({ type: "urls", parts: r.parts }))
              .catch(reject);
            break;
          case "upload-done":
            resolve(etags);
            break;
          case "error":
            reject(new Error(msg.message));
            break;
        }
      };
      send({ type: "upload", file, partSize, parts, concurrency: CONCURRENCY });
    });

  const complete = async (file: File, batchId: string, etags: Map<number, string>) => {
    setState({ phase: "completing", file, batchId });
    const body: CompleteBody = {
      parts: [...etags.entries()].sort(([a], [b]) => a - b).map(([part_number, etag]) => ({ part_number, etag })),
    };
    try {
      await batchesApi.complete(batchId, body);
    } catch (err) {
      // 422/413: o lote foi recusado de vez (REJECTED_SCHEMA); não há o que retomar.
      if (isApiError(err) && (err.status === 422 || err.status === 413)) await resumeStore.remove(batchId);
      throw err;
    }
    await resumeStore.remove(batchId);
    void queryClient.invalidateQueries({ queryKey: qk.batches.all });
    setState({ phase: "done", batchId });
  };

  /** Tenta retomar um upload pendente com o mesmo SHA-256. false se não há o que retomar. */
  const resume = async (file: File, pending: PendingUpload): Promise<boolean> => {
    let uploaded;
    try {
      // O servidor é a fonte da verdade das partes; o IndexedDB só lembra o batch_id.
      uploaded = await batchesApi.uploadedParts(pending.batchId);
    } catch (err) {
      if (isApiError(err) && (err.code === "INVALID_STATE" || err.status === 404)) {
        await resumeStore.remove(pending.batchId);
        return false;
      }
      throw err;
    }
    current.current.batchId = pending.batchId;
    const done = new Map(uploaded.parts.map((p) => [p.part_number, p.etag]));
    const missing = Array.from({ length: pending.partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
    const urls = missing.length ? (await batchesApi.renewParts(pending.batchId, missing)).parts : [];
    const etags = await uploadParts(file, pending.batchId, pending.partSize, urls, done, true);
    await complete(file, pending.batchId, etags);
    return true;
  };

  const start = useCallback(
    async (file: File, opts: { allowDuplicate?: boolean; sha256?: string } = {}) => {
      current.current = { batchId: null, cancelled: false };
      const localError = localCheck(file);
      if (localError) {
        setState({ phase: "invalid", file, reason: { code: "LOCAL", detail: localError } });
        return;
      }

      try {
        const known = lastHash.current?.file === file ? lastHash.current.sha256 : undefined;
        const sha256 = opts.sha256 ?? known ?? (await prepare(file));
        if (!sha256 || current.current.cancelled) return;
        lastHash.current = { file, sha256 };

        const pending = await resumeStore.findBySha(user.id, sha256, file.size);
        if (pending && (await resume(file, pending))) return;

        setState({ phase: "creating", file });
        let created;
        try {
          created = await batchesApi.create({
            filename: file.name,
            size_bytes: file.size,
            sha256,
            allow_duplicate: opts.allowDuplicate ?? false,
          });
        } catch (err) {
          if (isApiError(err, "DUPLICATE_FILE")) {
            const existing = (err.errors as { existing_batch_id?: unknown } | undefined)?.existing_batch_id;
            setState({ phase: "duplicate", file, sha256, existingBatchId: typeof existing === "string" ? existing : null });
            return;
          }
          throw err;
        }

        const { batch_id: batchId, upload } = created;
        current.current.batchId = batchId;
        const count = upload.part_count || partCount(file.size, upload.part_size_bytes);
        await resumeStore.save({
          batchId,
          userId: user.id,
          filename: file.name,
          size: file.size,
          lastModified: file.lastModified,
          sha256,
          partSize: upload.part_size_bytes,
          partCount: count,
          completed: {},
          createdAt: new Date().toISOString(),
        });

        // A API pode devolver só parte das URLs; as outras são pedidas na hora.
        const given = new Set(upload.parts.map((p) => p.part_number));
        const missing = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !given.has(n));
        const extra = missing.length ? (await batchesApi.renewParts(batchId, missing)).parts : [];

        const etags = await uploadParts(file, batchId, upload.part_size_bytes, [...upload.parts, ...extra], new Map(), false);
        await complete(file, batchId, etags);
      } catch (err) {
        if (current.current.cancelled) return;
        if (err instanceof ApiError && err.isClientError && !RETRYABLE_CODES.has(err.code)) {
          setState({ phase: "rejected", file, error: err });
        } else {
          const message = err instanceof Error ? err.message : "Falha no envio.";
          setState({ phase: "failed", file, message, retryable: true });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as funções internas só usam refs e setState
    [user.id],
  );

  /** Cancela de vez: aborta o multipart no servidor e esquece a retomada. */
  const cancel = useCallback(async () => {
    current.current.cancelled = true;
    worker.current?.postMessage({ type: "cancel" } satisfies ToWorker);
    const batchId = current.current.batchId;
    setState({ phase: "idle" });
    if (batchId) {
      await resumeStore.remove(batchId);
      await batchesApi.abort(batchId).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: qk.batches.all });
    }
  }, [queryClient]);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, start, cancel, reset };
}
