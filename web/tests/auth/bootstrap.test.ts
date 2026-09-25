import { describe, it, expect } from "vitest";
import { ensureWorkspace } from "@/lib/auth/bootstrap";

function fakeDb(existing: { workspace_id: string }[]) {
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const from = () => {
    const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: existing, error: null }) };
    return q;
  };
  const rpc = async (fn: string, args: unknown) => { rpcCalls.push({ fn, args }); return { data: "ws-new", error: null }; };
  return { db: { from, rpc } as never, rpcCalls };
}

describe("ensureWorkspace", () => {
  it("returns the existing membership without creating anything", async () => {
    const { db, rpcCalls } = fakeDb([{ workspace_id: "ws-1" }]);
    expect(await ensureWorkspace(db, "user-1", "a@b.co")).toBe("ws-1");
    expect(rpcCalls).toEqual([]);
  });
  it("returns the first (earliest) workspace when duplicates exist instead of creating another", async () => {
    const { db, rpcCalls } = fakeDb([{ workspace_id: "ws-oldest" }, { workspace_id: "ws-dup" }]);
    expect(await ensureWorkspace(db, "user-1", "a@b.co")).toBe("ws-oldest");
    expect(rpcCalls).toEqual([]);
  });
  it("creates through the locked SQL function for a new user", async () => {
    const { db, rpcCalls } = fakeDb([]);
    expect(await ensureWorkspace(db, "user-1", "a@b.co")).toBe("ws-new");
    expect(rpcCalls).toEqual([{ fn: "ensure_workspace", args: { p_user: "user-1", p_email: "a@b.co" } }]);
  });
});
