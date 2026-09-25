import { describe, it, expect } from "vitest";
import { monthMatrix, nextSlots, toDateKey } from "@/lib/schedule/slots";

describe("monthMatrix", () => {
  it("returns 6 weeks starting on Monday covering the month", () => {
    const m = monthMatrix(new Date(2026, 8, 1)); // Sep 2026 starts on a Tuesday
    expect(m).toHaveLength(6); expect(m[0]).toHaveLength(7);
    expect(m[0][0].getDay()).toBe(1); // Monday
    expect(toDateKey(m[0][1])).toBe("2026-09-01");
    expect(toDateKey(m[5][6])).toBe("2026-10-11");
  });
});

describe("nextSlots", () => {
  const from = new Date("2026-09-28T08:30:00Z"); // Monday
  it("weekdays at given times, skipping weekends, from the next future time", () => {
    const s = nextSlots({ type: "weekdays", times: ["09:00", "15:00"] }, from, 4, "UTC").map((d) => d.toISOString());
    expect(s).toEqual(["2026-09-28T09:00:00.000Z", "2026-09-28T15:00:00.000Z", "2026-09-29T09:00:00.000Z", "2026-09-29T15:00:00.000Z"]);
  });
  it("daily includes weekends; weekly returns one per week on the from-weekday", () => {
    const fri = new Date("2026-10-02T20:00:00Z");
    expect(nextSlots({ type: "daily", times: ["10:00"] }, fri, 2, "UTC").map((d) => d.toISOString())).toEqual(["2026-10-03T10:00:00.000Z", "2026-10-04T10:00:00.000Z"]);
    expect(nextSlots({ type: "weekly", times: ["10:00"] }, fri, 2, "UTC").map((d) => d.toISOString())).toEqual(["2026-10-09T10:00:00.000Z", "2026-10-16T10:00:00.000Z"]);
  });
  it("honours a target day: first time on that day even if it is in the past today", () => {
    const s = nextSlots({ type: "weekdays", times: ["10:00"] }, from, 1, "UTC", "2026-10-03");
    expect(s[0].toISOString()).toBe("2026-10-03T10:00:00.000Z");
  });
});
