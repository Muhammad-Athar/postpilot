import type { Metadata } from "next";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeApprovalToken } from "@/lib/approvals/consume";
import { PlatformPreview } from "@/components/inbox/PlatformPreview";
import { PLATFORM_RULES } from "@/lib/platforms/rules";
import type { DraftRow } from "@/lib/drafts/types";
import { ApprovalActions } from "./ApprovalActions";

export const metadata: Metadata = { title: "Approve a post · Postpilot" };
export const dynamic = "force-dynamic";

/** Public, login-free approval page. The token never appears in the page body. */
export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminSupabase();
  const c = await consumeApprovalToken(admin, token, process.env.APP_SECRET!);
  if (!c.ok) return <Shell><h1 className="font-serif text-3xl">Nothing to approve</h1><p className="mt-3 text-fg-muted">{c.reason}</p></Shell>;
  const [{ data: draft }, { data: brand }] = await Promise.all([
    admin.from("drafts").select("*").eq("id", c.draft.id).single(),
    admin.from("brands").select("name").eq("id", c.draft.brand_id).single(),
  ]);
  if (!draft) return <Shell><h1 className="font-serif text-3xl">Nothing to approve</h1><p className="mt-3 text-fg-muted">This post no longer exists.</p></Shell>;
  const d = draft as DraftRow;
  return (
    <Shell>
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{brand?.name ?? "Postpilot"} · {PLATFORM_RULES[d.platform]?.label ?? d.platform}</div>
      <h1 className="mt-1 font-serif text-3xl leading-tight">A post is waiting for your approval.</h1>
      <p className="mt-2 text-sm text-fg-muted">Approve it to put it on the calendar, or request changes with a note and a revised version will be prepared.</p>
      <div className="mt-6 rounded-[var(--radius)] border border-line bg-elev p-4 shadow-card"><PlatformPreview draft={d} /></div>
      <ApprovalActions token={token} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-fg">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 font-serif text-2xl">Postpilot</div>
        {children}
      </div>
    </main>
  );
}
