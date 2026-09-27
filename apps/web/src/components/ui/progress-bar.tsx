import { cn } from "@/lib/cn";

type ProgressBarProps = {
  label: string;
  /** 0–100; null mostra barra indeterminada (fase de consolidação, §9.3). */
  value: number | null;
  className?: string;
};

/** §3.1 Acessibilidade: role="progressbar" com aria-valuenow. */
export function ProgressBar({ label, value, className }: ProgressBarProps) {
  const indeterminate = value === null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      aria-valuetext={indeterminate ? "Em andamento" : undefined}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary", indeterminate ? "w-2/5 animate-[indeterminate_1.4s_ease-in-out_infinite]" : "transition-[width] duration-300")}
        style={indeterminate ? undefined : { width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}
