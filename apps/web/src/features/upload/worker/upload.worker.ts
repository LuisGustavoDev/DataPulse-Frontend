import type { PartUrl } from "@datapulse/contracts";
import { SAMPLE_BYTES, inspectSample } from "@datapulse/csv-rules";
import { createSHA256 } from "hash-wasm";
import { partRange, type FromWorker, type ToWorker } from "./protocol";

// Hash e envio das partes rodam aqui para não travar a interface (§3.1). O worker não
// conhece a API nem o token: pede URLs novas à página quando o MinIO responde 403.

// O tsconfig do app usa a lib "dom"; misturar com "webworker" gera conflito de tipos.
// Só estas duas APIs do escopo do worker são usadas.
const scope = self as unknown as {
  postMessage: (msg: FromWorker) => void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

const HASH_CHUNK = 8 * 1024 * 1024;
const MAX_ATTEMPTS = 5; // U1: cada parte é reenviada até 5 vezes
const MAX_RENEWALS = 3;

let cancelled = false;
const inflight = new Set<XMLHttpRequest>();
const urlWaiters = new Map<number, (url: string) => void>();

const post = (msg: FromWorker) => scope.postMessage(msg);

scope.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case "prepare":
      cancelled = false;
      prepare(msg.file).catch(() => post({ type: "error", code: "READ_FAILED", message: "Não foi possível ler o arquivo." }));
      break;
    case "upload":
      cancelled = false;
      upload(msg.file, msg.partSize, msg.parts, msg.concurrency).catch((err: unknown) => {
        if (cancelled) return;
        const failure = err instanceof UploadFailure ? err : new UploadFailure("PART_FAILED", "Falha ao enviar o arquivo.");
        post({ type: "error", code: failure.code, message: failure.message });
      });
      break;
    case "urls":
      for (const part of msg.parts) {
        urlWaiters.get(part.part_number)?.(part.url);
        urlWaiters.delete(part.part_number);
      }
      break;
    case "cancel":
      cancelled = true;
      for (const xhr of inflight) xhr.abort();
      inflight.clear();
      break;
  }
};

async function prepare(file: File) {
  const sample = new Uint8Array(await file.slice(0, SAMPLE_BYTES).arrayBuffer());
  const result = inspectSample(sample, file.size <= SAMPLE_BYTES);
  post({ type: "inspected", result });
  if (!result.ok) return;

  // SHA-256 em streaming (ADR 08): lê em blocos de 8 MiB, sem carregar 1 GiB na memória.
  const hasher = await createSHA256();
  hasher.init();
  for (let offset = 0; offset < file.size; offset += HASH_CHUNK) {
    if (cancelled) return;
    const chunk = await file.slice(offset, offset + HASH_CHUNK).arrayBuffer();
    hasher.update(new Uint8Array(chunk));
    post({ type: "hash-progress", bytes: Math.min(offset + HASH_CHUNK, file.size) });
  }
  post({ type: "hashed", sha256: hasher.digest("hex") });
}

class UploadFailure extends Error {
  constructor(
    readonly code: "PART_FAILED" | "NO_ETAG",
    message: string,
  ) {
    super(message);
  }
}

class Forbidden extends Error {}

async function upload(file: File, partSize: number, parts: PartUrl[], concurrency: number) {
  const queue = [...parts].sort((a, b) => a.part_number - b.part_number);

  // 4 partes em paralelo (§3, passo 2): cada "lane" puxa a próxima parte da fila.
  const lane = async () => {
    for (let part = queue.shift(); part; part = queue.shift()) {
      if (cancelled) return;
      await uploadPart(file, partSize, part);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, lane));
  if (!cancelled) post({ type: "upload-done" });
}

async function uploadPart(file: File, partSize: number, part: PartUrl) {
  const [start, end] = partRange(part.part_number, partSize, file.size);
  const body = file.slice(start, end);
  let url = part.url;
  let renewals = 0;

  for (let attempt = 1; ; attempt++) {
    try {
      const etag = await put(url, body, part.part_number);
      post({ type: "part-done", partNumber: part.part_number, etag, size: end - start });
      return;
    } catch (err) {
      if (cancelled) throw err;
      if (err instanceof UploadFailure) throw err;
      if (err instanceof Forbidden) {
        // U3: URL assinada expirou (1 h). Pede outra e tenta sem gastar tentativa.
        if (++renewals > MAX_RENEWALS) throw new UploadFailure("PART_FAILED", "O armazenamento recusou o envio.");
        url = await requestUrl(part.part_number);
        attempt--;
        continue;
      }
      if (attempt >= MAX_ATTEMPTS) {
        throw new UploadFailure("PART_FAILED", `A parte ${part.part_number} falhou ${MAX_ATTEMPTS} vezes. Verifique a conexão e retome o envio.`);
      }
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 16_000));
    }
  }
}

function requestUrl(partNumber: number): Promise<string> {
  return new Promise((resolve) => {
    urlWaiters.set(partNumber, resolve);
    post({ type: "need-urls", partNumbers: [partNumber] });
  });
}

/** PUT idempotente por part_number. XHR em vez de fetch para ter progresso de envio. */
function put(url: string, body: Blob, partNumber: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    inflight.add(xhr);
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => post({ type: "part-progress", partNumber, loaded: e.loaded });
    xhr.onload = () => {
      inflight.delete(xhr);
      if (xhr.status === 403) return reject(new Forbidden());
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`HTTP ${xhr.status}`));
      // Sem ETag exposto no CORS do MinIO não dá para concluir o multipart (§11.3).
      const etag = xhr.getResponseHeader("ETag");
      if (!etag) return reject(new UploadFailure("NO_ETAG", "O armazenamento não expôs o ETag (confira o CORS do MinIO)."));
      resolve(etag);
    };
    xhr.onerror = () => {
      inflight.delete(xhr);
      reject(new Error("network"));
    };
    xhr.onabort = () => {
      inflight.delete(xhr);
      reject(new Error("aborted"));
    };
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
