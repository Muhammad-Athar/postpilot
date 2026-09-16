"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { PLATFORMS, PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import type { CampaignSettings } from "@/lib/campaigns/settings";
import type { Reference } from "@/lib/campaigns/create";

type Props = { workspaceId: string; defaults: Partial<CampaignSettings> };
const input = "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

export function NewCampaignForm({ workspaceId, defaults }: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [urls, setUrls] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [s, setS] = useState<Partial<CampaignSettings>>({ platforms: ["bluesky", "instagram"], postsCount: 3, videosCount: 1, candidatesPerSlot: 2, hashtagCount: 5, videoLength: "30", voice: "Kore", allowAiBroll: false, tone: "friendly, confident, specific", language: "en", ...defaults });
  const [saveDefaults, setSaveDefaults] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: Platform) => setS((v) => ({ ...v, platforms: v.platforms?.includes(p) ? v.platforms.filter((x) => x !== p) : [...(v.platforms ?? []), p] }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      const references: Reference[] = [];
      if (files.length) {
        setBusy("Uploading references…");
        const sb = createBrowserSupabase();
        for (const f of files) {
          const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${workspaceId}/refs/${crypto.randomUUID()}-${safe}`;
          const { error } = await sb.storage.from("media").upload(path, f, { contentType: f.type });
          if (error) throw new Error(`Upload failed: ${error.message}`);
          references.push({ kind: f.type.startsWith("video/") ? "video" : "image", url: sb.storage.from("media").getPublicUrl(path).data.publicUrl, name: f.name });
        }
      }
      for (const u of urls.split(/\s+/).filter(Boolean)) references.push({ kind: "url", url: u });
      if (saveDefaults) {
        setBusy("Saving defaults…");
        await fetch("/api/settings/defaults", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
      }
      setBusy("Starting generation…");
      const res = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, references, settings: s }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.formErrors?.join(", ") || json.error || "Request failed");
      router.push(`/inbox?campaign=${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const native = PLATFORMS.filter((p) => PLATFORM_RULES[p].adapter === "native");
  const viaLate = PLATFORMS.filter((p) => PLATFORM_RULES[p].adapter === "late");

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px] max-w-5xl">
      <div className="space-y-4 rounded-2xl bg-white p-6 border border-neutral-200">
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <label className="block text-sm">What should we post about?
          <textarea required rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Launch of our monthly coffee subscription: first box ships free, beans roasted 48h before shipping, cancel anytime." className={input} />
        </label>
        <label className="block text-sm">Reference images or a video (optional)
          <input type="file" multiple accept="image/*,video/mp4,video/quicktime" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="mt-1 block text-sm" />
          {files.length > 0 && <div className="mt-1 text-xs text-neutral-500">{files.map((f) => f.name).join(", ")}</div>}
        </label>
        <label className="block text-sm">Reference links (optional, one per line)
          <textarea rows={2} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://…" className={input} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={!!busy} className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50">{busy ?? "Generate drafts"}</button>
      </div>

      <aside className="space-y-4 rounded-2xl bg-white p-6 border border-neutral-200 h-fit">
        <div className="text-sm font-medium">Settings for this request</div>
        <fieldset className="text-sm">
          <legend className="text-xs uppercase tracking-wide text-neutral-500">Platforms · native</legend>
          <div className="mt-1 flex flex-wrap gap-2">{native.map((p) => <Chip key={p} label={PLATFORM_RULES[p].label} on={!!s.platforms?.includes(p)} onClick={() => togglePlatform(p)} />)}</div>
          <legend className="mt-3 text-xs uppercase tracking-wide text-neutral-500">Platforms · via Late</legend>
          <div className="mt-1 flex flex-wrap gap-2">{viaLate.map((p) => <Chip key={p} label={PLATFORM_RULES[p].label} on={!!s.platforms?.includes(p)} onClick={() => togglePlatform(p)} />)}</div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Posts" v={s.postsCount ?? 3} min={1} max={10} set={(n) => setS({ ...s, postsCount: n })} />
          <Num label="Videos" v={s.videosCount ?? 1} min={0} max={5} set={(n) => setS({ ...s, videosCount: n })} />
          <Num label="Hashtags" v={s.hashtagCount ?? 5} min={0} max={30} set={(n) => setS({ ...s, hashtagCount: n })} />
          <label className="block text-sm">Candidates / slot
            <select value={s.candidatesPerSlot ?? 2} onChange={(e) => setS({ ...s, candidatesPerSlot: Number(e.target.value) as 2 | 3 })} className={input}><option value={2}>2</option><option value={3}>3</option></select>
          </label>
          <label className="block text-sm">Video length
            <select value={s.videoLength ?? "30"} onChange={(e) => setS({ ...s, videoLength: e.target.value as "15" | "30" | "60" })} className={input}><option value="15">15s</option><option value="30">30s</option><option value="60">60s</option></select>
          </label>
          <label className="block text-sm">Voice
            <select value={s.voice ?? "Kore"} onChange={(e) => setS({ ...s, voice: e.target.value })} className={input}>{["Kore", "Puck", "Charon", "Aoede", "Fenrir"].map((v) => <option key={v}>{v}</option>)}</select>
          </label>
        </div>
        <label className="block text-sm">Tone<input value={s.tone ?? ""} onChange={(e) => setS({ ...s, tone: e.target.value })} className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Language<input value={s.language ?? "en"} onChange={(e) => setS({ ...s, language: e.target.value })} className={input} /></label>
          <label className="block text-sm">CTA<input value={s.cta ?? ""} onChange={(e) => setS({ ...s, cta: e.target.value || undefined })} className={input} placeholder="Start your first box" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.allowAiBroll} onChange={(e) => setS({ ...s, allowAiBroll: e.target.checked })} />Allow AI-generated b-roll (uses daily quota)</label>
        <label className="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={saveDefaults} onChange={(e) => setSaveDefaults(e.target.checked)} />Save these as workspace defaults</label>
      </aside>
    </form>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs ${on ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`}>{label}</button>;
}
function Num({ label, v, min, max, set }: { label: string; v: number; min: number; max: number; set: (n: number) => void }) {
  return <label className="block text-sm">{label}<input type="number" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} className={input} /></label>;
}
