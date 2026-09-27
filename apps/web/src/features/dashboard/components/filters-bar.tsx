"use client";

import { TxStatus } from "@datapulse/contracts";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { addDaysIso, todayIso } from "@/lib/format";
import { TX_STATUS_LABEL } from "@/features/batches/labels";
import type { DashboardState } from "../filters";

type Props = DashboardState & { set: (patch: Record<string, string | null | undefined>) => void; showPeriod: boolean };

const PRESETS = [
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "12 meses", days: 365 },
];

/** Filtros numa linha acima dos gráficos; tudo vai para a query string. */
export function FiltersBar({ filters, set, showPeriod }: Props) {
  const selected = new Set(filters.status ?? []);

  const toggleStatus = (s: TxStatus) => {
    const next = new Set(selected);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    set({ status: next.size ? [...next].join(",") : null });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      {showPeriod && (
        <>
          <Field label="De" className="w-40">
            {(p) => <Input {...p} type="date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value })} />}
          </Field>
          <Field label="Até" className="w-40">
            {(p) => <Input {...p} type="date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value })} />}
          </Field>
          <div className="flex gap-1" role="group" aria-label="Períodos rápidos">
            {PRESETS.map((p) => (
              <Button
                key={p.days}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = todayIso();
                  set({ from: addDaysIso(today, -(p.days - 1)), to: today });
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Status da transação</legend>
        <div className="flex flex-wrap gap-1">
          {TxStatus.options.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={selected.has(s)}
              onClick={() => toggleStatus(s)}
              className="h-8 rounded-full border border-border px-3 text-xs hover:bg-surface-2 aria-pressed:border-primary aria-pressed:bg-info-bg aria-pressed:text-info"
            >
              {TX_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>
      <Button
        variant="ghost"
        size="sm"
        disabled={!filters.from && !filters.to && !filters.status}
        onClick={() => set({ from: null, to: null, status: null })}
      >
        Limpar filtros
      </Button>
    </div>
  );
}
