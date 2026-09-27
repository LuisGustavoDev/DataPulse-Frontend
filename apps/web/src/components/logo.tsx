import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-6 text-primary">
        <rect width="24" height="24" rx="6" fill="currentColor" />
        <path d="M4 13h3.5l2-5 3 9 2.5-6 1.5 2H20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      DataPulse
    </span>
  );
}
