"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";

/** Arrastar e soltar, com o botão de seleção como alternativa acessível (§3.1). */
export function Dropzone({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors",
        over ? "border-primary bg-info-bg" : "border-border bg-surface",
        disabled && "opacity-60",
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-10 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className="font-medium">Arraste o CSV para cá</p>
        <p className="text-sm text-muted">Até 1 GiB, separado por vírgula ou ponto e vírgula.</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed"
      >
        Escolher arquivo
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ""; // permite escolher o mesmo arquivo de novo
        }}
      />
    </div>
  );
}
