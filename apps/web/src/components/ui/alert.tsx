import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "./badge";

const tones: Record<Exclude<Tone, "neutral">, string> = {
  info: "border-info/30 bg-info-bg text-info",
  success: "border-success/30 bg-success-bg text-success",
  warning: "border-warning/30 bg-warning-bg text-warning",
  danger: "border-danger/30 bg-danger-bg text-danger",
};

type AlertProps = {
  tone?: Exclude<Tone, "neutral">;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function Alert({ tone = "info", title, children, actions, className }: AlertProps) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={cn(Boolean(title) && "mt-1", "text-fg/90")}>{children}</div>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
