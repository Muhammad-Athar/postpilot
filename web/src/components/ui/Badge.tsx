import type { ReactNode } from "react";
type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-muted text-fg-muted", accent: "bg-accent-soft text-accent-strong dark:text-accent",
  ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", danger: "bg-danger-soft text-danger", info: "bg-info-soft text-info",
};
export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tones[tone]} ${className}`}>{children}</span>;
}
