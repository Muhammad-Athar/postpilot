import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/0001_init.sql"), "utf8");
const tables = ["workspaces","workspace_members","brands","connected_accounts","campaigns","drafts","feedback_events","preference_summaries","render_jobs","schedule_slots","publish_jobs","metric_snapshots","approval_tokens","quota_usage"];
describe("0001_init.sql", () => {
  it.each(tables)("creates table %s", (t) => expect(sql).toMatch(new RegExp(`create table\\s+${t}\\b`, "i")));
  it("enables pgvector", () => expect(sql).toMatch(/create extension if not exists vector/i));
  it("defines the draft transition trigger", () => expect(sql).toMatch(/enforce_draft_transition/));
  it("enables RLS on every workspace-scoped table", () => {
    const loop = sql.match(/foreach t in array array\[([^\]]+)\] loop\s+execute format\('alter table %I enable row level security'/i);
    expect(loop).not.toBeNull();
    for (const t of tables.filter((t) => !["workspace_members", "quota_usage"].includes(t))) expect(loop![1]).toContain(`'${t}'`);
    expect(sql).toMatch(/alter table workspace_members enable row level security/i);
  });
});
