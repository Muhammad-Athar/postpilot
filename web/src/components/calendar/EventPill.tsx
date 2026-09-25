import type { CalendarEvent } from "@/lib/schedule/events";
import { PLATFORM_RULES } from "@/lib/platforms/rules";
const tone: Record<CalendarEvent["kind"], string> = {
  scheduled: "bg-accent-soft text-accent-strong dark:text-accent", published: "bg-ok-soft text-ok", failed: "bg-danger-soft text-danger", review: "bg-info-soft text-info", campaign: "bg-muted text-fg-muted",
};
export function EventPill({ e, compact = false }: { e: CalendarEvent; compact?: boolean }) {
  const label = e.platform ? PLATFORM_RULES[e.platform]?.label : undefined;
  return (
    <div className={`truncate rounded-md px-1.5 py-0.5 text-[11px] leading-4 ${tone[e.kind]}`} title={e.title}>
      {e.time && <span className="mr-1 tabular-nums opacity-80">{e.time}</span>}
      {!compact && label && <span className="mr-1 opacity-80">{label} ·</span>}
      {e.title}
    </div>
  );
}
