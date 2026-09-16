import { describe, it, expect } from "vitest";
import { ensureWorkspace } from "@/lib/auth/bootstrap";

function fakeDb(existing: { workspace_id: string } | null) {
  const inserted: Record<string, unknown[]> = {};
  const from = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
    insert: (row: unknown) => {
      (inserted[table] ??= []).push(row);
      return { select: () => ({ single: async () => ({ data: { id: `${table}-id`, ...(row as object) }, error: null }) }) };
    },
  });
  return { db: { from } as never, inserted };
}

describe("ensureWorkspace", () => {
  it("returns existing membership without inserting", async () => {
    const { db, inserted } = fakeDb({ workspace_id: "ws-1" });
    expect(await ensureWorkspace(db, "user-1", "a@b.co")).toBe("ws-1");
    expect(inserted).toEqual({});
  });
  it("creates workspace, membership, brand and preference row for a new user", async () => {
    const { db, inserted } = fakeDb(null);
    expect(await ensureWorkspace(db, "user-1", "a@b.co")).toBe("workspaces-id");
    expect(Object.keys(inserted)).toEqual(["workspaces", "workspace_members", "brands", "preference_summaries"]);
    expect(inserted.brands[0]).toMatchObject({ workspace_id: "workspaces-id", name: "My brand" });
    expect(inserted.workspace_members[0]).toMatchObject({ user_id: "user-1", role: "owner" });
  });
});
