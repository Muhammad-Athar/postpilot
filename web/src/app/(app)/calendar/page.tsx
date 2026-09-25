import { Suspense } from "react";
import { format, parse, isValid } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getSession } from "@/lib/auth/session";
import { listMonthEvents } from "@/lib/schedule/events";
import { PageTitle } from "@/components/ui/Heading";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const { workspace, brand, admin } = await getSession();
  const { month, date } = await searchParams;
  const today = format(toZonedTime(new Date(), workspace.timezone), "yyyy-MM-dd");
  const selected = date && isValid(parse(date, "yyyy-MM-dd", new Date())) ? date : today;
  const monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : selected.slice(0, 7);
  const events = await listMonthEvents(admin, brand.id, parse(monthKey, "yyyy-MM", new Date()), workspace.timezone);
  const cadence = workspace.cadence_rule as { type?: string; times?: string[] };
  return (
    <div>
      <PageTitle sub={`Cadence: ${cadence.type ?? "weekdays"} at ${(cadence.times ?? ["10:00"]).join(", ")} · ${workspace.timezone}. Approved drafts take the next open slot; click a day twice to create content for it.`}>Calendar</PageTitle>
      <Suspense><CalendarView month={monthKey} events={events} today={today} initialSelected={selected} tz={workspace.timezone} publishEnabled /></Suspense>
    </div>
  );
}
