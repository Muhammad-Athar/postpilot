import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/0001_init.sql"), "utf8");
const tables = ["workspaces","workspace_members","brands","connected_accounts","campaigns","drafts","feedback_events","preference_summaries","render_jobs","schedule_slots","publish_jobs","metric_snapshots","approval_tokens","quota_usage"];
describe("0001_init.sql", () => {
  it.each(tables)("creates table %s", (t) => expect(sql).toMatch(new RegExp(`create table\\s+${t}\\b`, "i")));
  it("enables pgvector", () => expect(sql).toMatch(/create extension if not exists vector/i));
  it("defines the draft transition trigger", () => expect(sql).toMatch(/enforce_draft_transition/));
  it("scopes storage writes to the caller's workspace prefix and locks quota_usage", () => {
    expect(sql).toMatch(/media_write[\s\S]*is_member\(\(\(storage\.foldername\(name\)\)\[1\]\)::uuid\)/);
    expect(sql).toMatch(/alter table quota_usage enable row level security/i);
    expect(sql).not.toMatch(/auth\.role\(\) = 'authenticated'/);
  });
  it("uses composite tenant foreign keys on child tables", () => {
    expect(sql).toMatch(/foreign key \(campaign_id, workspace_id\) references campaigns\(id, workspace_id\)/);
    expect(sql).toMatch(/foreign key \(draft_id, workspace_id\) references drafts\(id, workspace_id\)/);
    expect(sql).toMatch(/foreign key \(account_id, workspace_id\) references connected_accounts\(id, workspace_id\)/);
  });
  it("pins search_path on security definer helpers and restricts workspace writes to owners", () => {
    expect(sql).toMatch(/is_member[\s\S]*security definer set search_path = public/);
    expect(sql).toMatch(/ws_owner_write on workspaces for update using \(is_owner\(id\)\)/);
  });
  it("enables RLS on every workspace-scoped table", () => {
    const loop = sql.match(/foreach t in array array\[([^\]]+)\] loop\s+execute format\('alter table %I enable row level security'/i);
    expect(loop).not.toBeNull();
    for (const t of tables.filter((t) => !["workspace_members", "quota_usage"].includes(t))) expect(loop![1]).toContain(`'${t}'`);
    expect(sql).toMatch(/alter table workspace_members enable row level security/i);
  });
});
