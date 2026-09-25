import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/api/guard";
import { createApprovalLink } from "@/lib/approvals/issue";
import { sendEmail } from "@/lib/notify/send";
import { brandKitSchema } from "@/lib/brand/schema";
import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";

/** Issues an approval link for a draft still in review; emails it to the brand's approver when asked and configured. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { brand, admin } = await getSession();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: boolean };
  const { data: d } = await admin.from("drafts").select("id, workspace_id, version, status, hook, platform").eq("id", id).eq("brand_id", brand.id).single();
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (d.status !== "draft") return NextResponse.json({ error: "Only posts still in review can be shared for approval." }, { status: 409 });
  const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const to = brandKitSchema.safeParse(brand.kit).data?.approverEmail ?? null;
  const link = await createApprovalLink(admin, { draft: d, channel: email && to ? "email" : "link", baseUrl });
  let emailed = false;
  if (email && to) {
    const label = PLATFORM_RULES[d.platform as Platform]?.label ?? d.platform;
    emailed = await sendEmail({ to, subject: `Approve: ${d.hook.slice(0, 60)}`, html: `<p>${escape(brand.name)} has a ${escape(label)} post ready for your approval.</p><p><a href="${link.url}">Review and approve</a></p><p style="color:#777">The link works once and expires in 72 hours.</p>` });
  }
  return NextResponse.json({ url: link.url, expiresAt: link.expiresAt, emailed, approverEmail: to });
}
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
