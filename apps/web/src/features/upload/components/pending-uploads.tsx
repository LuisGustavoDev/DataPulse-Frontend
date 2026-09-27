"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { PendingUpload } from "../resume-store";

type Props = {
  uploads: PendingUpload[];
  onDiscard: (upload: PendingUpload) => void;
};

/** U2: uploads interrompidos. Para continuar, basta escolher o mesmo arquivo de novo. */
export function PendingUploads({ uploads, onDiscard }: Props) {
  if (uploads.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Envios interrompidos"
        description="Escolha o mesmo arquivo de novo para continuar de onde parou. As partes já enviadas não sobem de novo."
      />
      <ul className="divide-y divide-border">
        {uploads.map((u) => {
          const done = Object.keys(u.completed).length;
          return (
            <li key={u.batchId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.filename}</p>
                <p className="text-xs text-muted">
                  {formatBytes(u.size)} · {done} de {u.partCount} partes · iniciado em {formatDateTime(u.createdAt)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onDiscard(u)}>
                Descartar
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
