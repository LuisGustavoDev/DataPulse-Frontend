// O bundler só compila o worker como entrada separada quando reconhece este padrão
// literal: new Worker(new URL("./arquivo", import.meta.url)). No Next 16.3 o Turbopack
// emite o .ts cru em vez de compilar, por isso o app usa --webpack (ver README).
export function createUploadWorker(): Worker {
  return new Worker(new URL("./upload.worker.ts", import.meta.url));
}
