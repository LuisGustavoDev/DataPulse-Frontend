import { cn } from "@/lib/cn";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn("inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
      />
      {label && <span className="text-sm text-muted">{label}</span>}
    </span>
  );
}

export function FullPageSpinner({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-primary">
      <Spinner label={label} />
    </div>
  );
}
