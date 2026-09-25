import { addDays, addWeeks, startOfMonth, startOfWeek, endOfMonth, endOfWeek, eachDayOfInterval, format, isBefore, parse } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type CadenceRule = { type?: "daily" | "weekdays" | "weekly" | string; times?: string[] };
export const toDateKey = (d: Date) => format(d, "yyyy-MM-dd");

/** 6×7 matrix of dates, weeks starting Monday, always covering the whole month. */
export function monthMatrix(monthStart: Date): Date[][] {
  const start = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 });
  let end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  while (days.length < 42) { end = addDays(end, 1); days.push(end); }
  const rows: Date[][] = [];
  for (let i = 0; i < 42; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

/** Next `count` posting datetimes after `from`, in the workspace timezone. When `targetDay` (yyyy-MM-dd) is given, the day's slots are returned in order even if already past. */
export function nextSlots(rule: CadenceRule, from: Date, count: number, tz: string, targetDay?: string): Date[] {
  const times = (rule.times?.length ? rule.times : ["10:00"]).map((t) => t.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).sort();
  const type = rule.type ?? "weekdays";
  const out: Date[] = [];
  const localFrom = toZonedTime(from, tz);
  const build = (day: Date, t: string) => fromZonedTime(parse(`${format(day, "yyyy-MM-dd")} ${t}`, "yyyy-MM-dd HH:mm", new Date()), tz);
  if (targetDay) {
    const day = parse(targetDay, "yyyy-MM-dd", new Date());
    for (const t of times) { out.push(build(day, t)); if (out.length >= count) break; }
    return out;
  }
  let day = new Date(localFrom.getFullYear(), localFrom.getMonth(), localFrom.getDate());
  for (let guard = 0; guard < 400 && out.length < count; guard++) {
    const dow = day.getDay();
    const allowed = type === "daily" || (type === "weekdays" && dow >= 1 && dow <= 5) || (type === "weekly" && dow === localFrom.getDay());
    if (allowed) for (const t of times) { const at = build(day, t); if (!isBefore(at, from) && at.getTime() !== from.getTime()) { out.push(at); if (out.length >= count) break; } }
    day = type === "weekly" && allowed ? addWeeks(day, 1) : addDays(day, 1);
  }
  return out;
}
