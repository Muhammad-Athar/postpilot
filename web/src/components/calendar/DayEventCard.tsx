"use client";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { CalendarClock, ExternalLink, Send, Undo2 } from "lucide-react";
import type { CalendarEvent } from "@/lib/schedule/events";
import { PLATFORM_RULES } from "@/lib/platforms/rules";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Tooltip } from "@/components/ui/Tooltip";

type Props = { e: CalendarEvent; day: string; tz: string; onChanged: (patch?: Partial<CalendarEvent>) => void; publishEnabled?: boolean };

/** One event in the calendar's day panel, with the actions a scheduled post allows. */
export function DayEventCard({ e, day, tz, onChanged, publishEnabled = false }: Props) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tone = e.kind === "published" ? "ok" : e.kind === "failed" ? "danger" : e.kind === "review" ? "info" : "accent";

  const call = (fn: () => Promise<Response>, after?: (j: Record<string, unknown>) => void) => start(async () => {
    setError(null);
    const r = await fn(); const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError((j as { error?: string }).error ?? "Something went wrong");
    after?.(j as Record<string, unknown>);
  });
  const move = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const value = String(new FormData(ev.currentTarget).get("at") || "");
    if (!value) return;
    const at = fromZonedTime(value, tz).toISOString();
    call(() => fetch(`/api/schedule/${e.slotId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ at }) }), () => { setMoveOpen(false); onChanged(); });
  };
  const unschedule = () => call(() => fetch(`/api/schedule/${e.slotId}`, { method: "DELETE" }), () => onChanged());
  const publishNow = () => call(() => fetch(`/api/publish/${e.slotId}`, { method: "POST" }), (j) => onChanged({ kind: "published", permalink: (j.permalink as string | null) ?? null, error: (j.error as string | null) ?? null }));

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-line bg-bg p-3">
      <div className="flex items-center gap-2">
        {e.time && <span className="font-mono text-xs text-fg-muted">{e.time}</span>}
        {e.platform && <Badge tone="neutral">{PLATFORM_RULES[e.platform]?.label ?? e.platform}</Badge>}
        <Badge tone={tone}>{e.kind}</Badge>
      </div>
      <p className="mt-2 font-serif text-lg leading-snug">{e.title}</p>
      {(e.kind === "review" || e.kind === "campaign") && <a href="/inbox" className="mt-2 inline-block text-xs text-accent-strong underline-offset-2 hover:underline dark:text-accent">Open inbox →</a>}
      {e.kind === "published" && e.permalink && (
        <a href={e.permalink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent-strong underline-offset-2 hover:underline dark:text-accent">View post <ExternalLink size={12} /></a>
      )}
      {e.kind === "published" && e.error && <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-fg-muted">{e.error}</p>}
      {e.kind === "failed" && e.error && <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">{e.error}</p>}
      {e.kind === "scheduled" && e.slotId && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Tooltip label="Pick another date and time"><span><Button size="sm" variant="secondary" onClick={() => setMoveOpen(true)} disabled={pending}><CalendarClock size={14} /> Move</Button></span></Tooltip>
          <Tooltip label="Take it off the calendar; it stays approved"><span><Button size="sm" variant="secondary" loading={pending} onClick={unschedule}><Undo2 size={14} /> Unschedule</Button></span></Tooltip>
          <Tooltip label={publishEnabled ? "Publish this post right now" : "Arrives with publishing"}><span><Button size="sm" variant="accent" loading={pending} disabled={!publishEnabled} onClick={publishNow}><Send size={14} /> Publish now</Button></span></Tooltip>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen} title="Move this post" description={`Times are in ${tz}.`}>
        <form onSubmit={move} className="space-y-4">
          <Field label="New date and time"><Input name="at" type="datetime-local" required defaultValue={`${day}T${e.time ?? "10:00"}`} min={format(new Date(), "yyyy-MM-dd'T'HH:mm")} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setMoveOpen(false)}>Cancel</Button><Button type="submit" variant="accent" loading={pending}>Move</Button></div>
        </form>
      </Dialog>
    </motion.div>
  );
}
