import { describe, it, expect } from "vitest";
import { TIMEZONES, isValidTimezone, timezoneLabel } from "@/lib/schedule/timezones";
describe("timezones", () => {
  it("lists IANA zones and validates them", () => {
    expect(TIMEZONES).toContain("Asia/Karachi");
    expect(TIMEZONES).toContain("UTC");
    expect(isValidTimezone("Asia/Karachi")).toBe(true);
    expect(isValidTimezone("Asia/Karachee")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
  it("labels a zone with its current offset", () => {
    expect(timezoneLabel("Asia/Karachi", new Date("2026-06-01T00:00:00Z"))).toBe("Asia/Karachi (UTC+05:00)");
    expect(timezoneLabel("UTC", new Date("2026-06-01T00:00:00Z"))).toBe("UTC (UTC+00:00)");
  });
});
