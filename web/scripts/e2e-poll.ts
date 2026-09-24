import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const [cmd, cid] = process.argv.slice(2);
(async () => {
  if (cmd === "seed") {
    const { data: b } = await a.from("brands").select("id, workspace_id").limit(1).single();
    const { data: c } = await a.from("campaigns").insert({ workspace_id: b!.workspace_id, brand_id: b!.id, prompt: "Launch of our monthly coffee subscription: first box ships free, beans roasted 48h before shipping, cancel anytime.", references: [], settings: { platforms: ["bluesky", "instagram"], candidatesPerSlot: 2, postsCount: 2, videosCount: 1, hashtagCount: 5, tone: "warm, witty", language: "en", videoLength: "30", voice: "Kore", allowAiBroll: false }, status: "generating" }).select("id").single();
    process.stdout.write(c!.id); return;
  }
  const { count } = await a.from("drafts").select("id", { count: "exact", head: true }).eq("campaign_id", cid);
  const { data: c } = await a.from("campaigns").select("status, error").eq("id", cid).maybeSingle();
  console.log(count ?? 0, c?.status ?? "?", c?.error ?? "");
})();
