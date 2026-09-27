"use client";

import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Import modular: só os gráficos usados entram no bundle.
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer]);

export type ChartTheme = {
  series: string[];
  text: string;
  muted: string;
  grid: string;
  surface: string;
  font: string;
};

function readTheme(): ChartTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    series: [v("--chart-1"), v("--chart-2"), v("--chart-3"), v("--chart-4")],
    text: v("--fg"),
    muted: v("--muted"),
    grid: v("--chart-grid"),
    surface: v("--surface"),
    font: getComputedStyle(document.body).fontFamily,
  };
}

/** Cores do tema atual; muda junto com o modo escuro do sistema. */
function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(readTheme());
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return theme;
}

type EChartProps = {
  /** Monta a option com as cores do tema; chamada de novo quando o tema ou os dados mudam. */
  option: (theme: ChartTheme) => EChartsCoreOption;
  /** Descrição para leitor de tela; o canvas em si não é acessível. */
  ariaLabel: string;
  className?: string;
};

export function EChart({ option, ariaLabel, className }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const theme = useChartTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: "canvas" });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (!theme || !chart.current) return;
    chart.current.setOption(
      {
        animationDuration: 300,
        textStyle: { fontFamily: theme.font, color: theme.muted },
        aria: { enabled: true, label: { description: ariaLabel } },
        ...option(theme),
      },
      { notMerge: true },
    );
  }, [option, theme, ariaLabel]);

  return <div ref={ref} role="img" aria-label={ariaLabel} className={cn("h-72 w-full", className)} />;
}

/** Tooltip e eixos no mesmo estilo em todos os gráficos: grade recessiva, texto neutro. */
export function baseAxes(theme: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: theme.grid } },
    axisTick: { show: false },
    axisLabel: { color: theme.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: theme.grid, type: "dashed" as const } },
  };
}

export function baseTooltip(theme: ChartTheme) {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.grid,
    textStyle: { color: theme.text, fontSize: 12 },
    confine: true,
  };
}
