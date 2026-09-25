const supported = (): string[] => {
  const i = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = i.supportedValuesOf ? i.supportedValuesOf("timeZone") : [];
  return Array.from(new Set(["UTC", ...list])).sort();
};
export const TIMEZONES: string[] = supported();

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** "Asia/Karachi (UTC+05:00)" for the offset in force at `now`. */
export function timezoneLabel(tz: string, now = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const off = part === "GMT" ? "UTC+00:00" : part.replace("GMT", "UTC");
  return `${tz} (${off})`;
}
