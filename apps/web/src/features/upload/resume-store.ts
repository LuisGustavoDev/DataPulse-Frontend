// Estado da retomada no IndexedDB (§3.1): batch_id, partes concluídas, nome, tamanho e
// lastModified. O navegador não guarda acesso ao arquivo; ao voltar, o usuário
// seleciona de novo e o upload continua se o SHA-256 bater (U2).

export type PendingUpload = {
  batchId: string;
  /** Uploads de outro usuário na mesma máquina não aparecem. */
  userId: string;
  filename: string;
  size: number;
  lastModified: number;
  sha256: string;
  partSize: number;
  partCount: number;
  completed: Record<number, string>; // part_number → ETag
  createdAt: string;
};

const DB_NAME = "datapulse";
const STORE = "pending-uploads";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "batchId" });
      store.createIndex("userId", "userId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const resumeStore = {
  list: (userId: string) =>
    tx<PendingUpload[]>("readonly", (s) => s.index("userId").getAll(userId)).catch(() => []),

  get: (batchId: string) => tx<PendingUpload | undefined>("readonly", (s) => s.get(batchId)),

  save: (upload: PendingUpload) => tx("readwrite", (s) => s.put(upload)),

  remove: (batchId: string) => tx("readwrite", (s) => s.delete(batchId)).catch(() => undefined),

  async markPart(batchId: string, partNumber: number, etag: string) {
    const current = await resumeStore.get(batchId);
    if (!current) return;
    current.completed[partNumber] = etag;
    await resumeStore.save(current);
  },

  /** Retomada candidata: mesmo usuário, mesmo SHA-256 e mesmo tamanho. */
  async findBySha(userId: string, sha256: string, size: number) {
    const all = await resumeStore.list(userId);
    return all.find((u) => u.sha256 === sha256 && u.size === size);
  },
};
