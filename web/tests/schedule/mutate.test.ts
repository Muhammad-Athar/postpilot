import { describe, it, expect } from "vitest";
import { rescheduleSlot, unscheduleSlot } from "@/lib/schedule/mutate";

/** Minimal chainable Supabase stub: records every call, returns `rows[table]` from the terminal await. */
function stub(rows: Record<string, unknown[]>) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const admin = { from: (table: string) => {
    const chain: Record<string, unknown> = new Proxy({}, { get: (_t, prop: string) => {
      if (prop === "then") return (res: (v: unknown) => void) => res({ data: rows[table] ?? [], error: null });
      return (...args: unknown[]) => { calls.push({ table, op: prop, args }); return chain; };
    } });
    return chain;
  } };
  return { admin: admin as never, calls };
}

describe("schedule mutations", () => {
  it("reschedule updates only a slot that belongs to the brand", async () => {
    const { admin, calls } = stub({ schedule_slots: [{ id: "s1", brand_id: "b1", draft_id: "d1", status: "filled" }] });
    await rescheduleSlot(admin, { slotId: "s1", brandId: "b1", at: new Date("2026-10-01T05:00:00Z") });
    const upd = calls.find((c) => c.table === "schedule_slots" && c.op === "update");
    expect(upd?.args[0]).toEqual({ scheduled_at: "2026-10-01T05:00:00.000Z" });
    expect(calls.some((c) => c.op === "eq" && c.args[0] === "brand_id" && c.args[1] === "b1")).toBe(true);
  });
  it("reschedule refuses a slot already published", async () => {
    const { admin } = stub({ schedule_slots: [{ id: "s1", brand_id: "b1", draft_id: "d1", status: "done" }] });
    await expect(rescheduleSlot(admin, { slotId: "s1", brandId: "b1", at: new Date(Date.now() + 3600e3) })).rejects.toThrow(/already published/);
  });
  it("reschedule refuses a time in the past", async () => {
    const { admin } = stub({ schedule_slots: [{ id: "s1", brand_id: "b1", draft_id: "d1", status: "filled" }] });
    await expect(rescheduleSlot(admin, { slotId: "s1", brandId: "b1", at: new Date("2020-01-01T00:00:00Z") })).rejects.toThrow(/future/);
  });
  it("unschedule deletes the slot and returns the draft to approved", async () => {
    const { admin, calls } = stub({ schedule_slots: [{ id: "s1", brand_id: "b1", draft_id: "d1", status: "filled" }] });
    await unscheduleSlot(admin, { slotId: "s1", brandId: "b1" });
    expect(calls.some((c) => c.table === "schedule_slots" && c.op === "delete")).toBe(true);
    const upd = calls.find((c) => c.table === "drafts" && c.op === "update");
    expect(upd?.args[0]).toEqual({ status: "approved" });
  });
  it("unknown slot → 404", async () => {
    const { admin } = stub({ schedule_slots: [] });
    await expect(unscheduleSlot(admin, { slotId: "nope", brandId: "b1" })).rejects.toMatchObject({ status: 404 });
  });
});
