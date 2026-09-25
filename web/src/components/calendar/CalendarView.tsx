"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { addDays, addMonths, format, isSameMonth, parse } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { monthMatrix, toDateKey } from "@/lib/schedule/slots";
import type { CalendarEvent } from "@/lib/schedule/events";
import { EventPill } from "./EventPill";
import { DayEventCard } from "./DayEventCard";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

type Props = { month: string; events: Record<string, CalendarEvent[]>; today: string; initialSelected: string; tz: string; publishEnabled?: boolean };
type EventMap = Record<string, CalendarEvent[]>;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ month: initialMonth, events: initialEvents, today, initialSelected, tz, publishEnabled = false }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [month, setMonth] = useState(initialMonth);
  const [cache, setCache] = useState<Record<string, EventMap>>({ [initialMonth]: initialEvents });
  const [loading, setLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState(initialSelected);
  const [dir, setDir] = useState(0);
  const monthStart = useMemo(() => parse(month, "yyyy-MM", new Date()), [month]);
  const rows = useMemo(() => monthMatrix(monthStart), [monthStart]);
  const selectedDate = parse(selected, "yyyy-MM-dd", new Date());
  // events from every loaded month, so days at the edges of the grid stay populated
  const events = useMemo(() => Object.assign({}, ...Object.values(cache)) as EventMap, [cache]);
  const dayEvents = events[selected] ?? [];

  const load = useCallback(async (m: string) => {
    if (cache[m]) return;
    setLoading((l) => l ?? m);
    try {
      const r = await fetch(`/api/calendar?month=${m}`);
      if (r.ok) { const j = await r.json(); setCache((c) => ({ ...c, [m]: j.events })); }
    } finally { setLoading((l) => (l === m ? null : l)); }
  }, [cache]);

  // prefetch neighbours so prev/next feel instant
  useEffect(() => { [-1, 1].forEach((d) => { void load(format(addMonths(monthStart, d), "yyyy-MM")); }); }, [monthStart, load]);

  const syncUrl = useCallback((m: string, day: string) => window.history.replaceState(null, "", `/calendar?month=${m}&date=${day}`), []);
  const go = useCallback((delta: number) => {
    setDir(delta);
    const m = format(addMonths(monthStart, delta), "yyyy-MM");
    setMonth(m); syncUrl(m, selected); void load(m);
  }, [monthStart, selected, load, syncUrl]);
  const create = useCallback((day: string) => router.push(`/campaigns/new?date=${day}`), [router]);
  /** After a slot changes: patch the event in place when told what changed, else drop cached months and reload. */
  const changed = useCallback((id: string, patch?: Partial<CalendarEvent>) => {
    if (patch) { setCache((c) => Object.fromEntries(Object.entries(c).map(([m, ev]) => [m, Object.fromEntries(Object.entries(ev).map(([k, list]) => [k, list.map((x) => (x.id === id ? { ...x, ...patch } : x))]))]))); return; }
    setCache({});
    fetch(`/api/calendar?month=${month}`).then((r) => r.ok ? r.json() : null).then((j) => { if (j) setCache({ [month]: j.events }); });
    router.refresh();
  }, [month, router]);
  const pick = (d: Date) => {
    const key = toDateKey(d);
    if (key === selected) return create(key);           // second click on the selected day
    setSelected(key);
    if (!isSameMonth(d, monthStart)) { const m = format(d, "yyyy-MM"); setDir(d < monthStart ? -1 : 1); setMonth(m); void load(m); syncUrl(m, key); }
    else { const q = new URLSearchParams(params.toString()); q.set("month", month); q.set("date", key); window.history.replaceState(null, "", `/calendar?${q}`); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (e.key in map) { e.preventDefault(); pick(addDays(selectedDate, map[e.key])); }
      if (e.key === "Enter") create(selected);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <section className="rounded-[var(--radius)] border border-line bg-elev shadow-card">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Tooltip label="Previous month"><button onClick={() => go(-1)} className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-muted hover:text-fg" aria-label="Previous month"><ChevronLeft size={18} /></button></Tooltip>
            <h2 className="w-44 text-center font-serif text-2xl">{format(monthStart, "MMMM yyyy")}{loading === month && <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle" aria-label="Loading" />}</h2>
            <Tooltip label="Next month"><button onClick={() => go(1)} className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-muted hover:text-fg" aria-label="Next month"><ChevronRight size={18} /></button></Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => { const m = today.slice(0, 7); setDir(m < month ? -1 : 1); setSelected(today); setMonth(m); void load(m); syncUrl(m, today); }}>Today</Button>
            <Tooltip label="Create content for the selected day"><span><Button size="sm" variant="accent" onClick={() => create(selected)}><Plus size={16} /> New</Button></span></Tooltip>
          </div>
        </header>
        <div className="grid grid-cols-7 border-b border-line text-center text-[11px] uppercase tracking-wide text-fg-subtle">{WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}</div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={month} initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="grid grid-cols-7">
            {rows.flat().map((d) => {
              const key = toDateKey(d); const evs = events[key] ?? []; const inMonth = isSameMonth(d, monthStart);
              const isSel = key === selected; const isToday = key === today;
              return (
                <button key={key} onClick={() => pick(d)} onDoubleClick={() => create(key)} aria-label={format(d, "EEEE d MMMM")} aria-pressed={isSel}
                  className={`group flex min-h-[104px] cursor-pointer flex-col items-stretch gap-1 border-b border-r border-line p-1.5 text-left transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${isSel ? "bg-accent-soft/50" : "hover:bg-muted/60"} ${inMonth ? "" : "opacity-45"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${isToday ? "bg-accent text-accent-fg font-semibold" : isSel ? "font-semibold" : "text-fg-muted"}`}>{d.getDate()}</span>
                    {evs.length > 0 && <span className="flex gap-0.5">{evs.slice(0, 3).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.kind === "published" ? "bg-ok" : e.kind === "failed" ? "bg-danger" : e.kind === "review" ? "bg-info" : "bg-accent"}`} />)}</span>}
                  </div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((e) => <EventPill key={e.id} e={e} compact />)}
                    {evs.length > 3 && <div className="px-1 text-[11px] text-fg-subtle">+{evs.length - 3} more</div>}
                  </div>
                  {isSel && <div className="mt-auto hidden text-[10px] text-fg-subtle group-hover:block">Click again to create</div>}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </section>

      <aside className="h-fit rounded-[var(--radius)] border border-line bg-elev p-5 shadow-card xl:sticky xl:top-24">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{format(selectedDate, "EEEE")}</div>
            <div className="font-serif text-3xl leading-tight">{format(selectedDate, "d MMMM")}</div>
          </div>
          <Tooltip label="Create content for this day"><button onClick={() => create(selected)} aria-label="Create content for this day" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-accent text-accent-fg shadow-card transition-transform hover:scale-105 active:scale-95"><Plus size={18} /></button></Tooltip>
        </div>
        <div className="mt-5 space-y-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {dayEvents.length === 0 ? (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-fg-muted">Nothing scheduled. Press <span className="font-medium text-fg">+</span> to create content for this day.</motion.p>
            ) : dayEvents.map((e) => <DayEventCard key={e.id} e={e} day={selected} tz={tz} publishEnabled={publishEnabled} onChanged={(patch) => changed(e.id, patch)} />)}
          </AnimatePresence>
        </div>
      </aside>
    </div>
  );
}
