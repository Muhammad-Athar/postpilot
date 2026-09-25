"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Dropzone } from "./Dropzone";
import { motion } from "framer-motion";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { PLATFORMS, PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import type { CampaignSettings } from "@/lib/campaigns/settings";
import type { Reference } from "@/lib/campaigns/create";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, Label } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/Heading";

type Props = { workspaceId: string; defaults: Partial<CampaignSettings> };

export function NewCampaignForm({ workspaceId, defaults }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [scheduledFor, setScheduledFor] = useState<string>(params.get("date") ?? "");
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
      const res = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, references, settings: s, scheduledFor: scheduledFor || undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.formErrors?.join(", ") || json.error || "Request failed");
      router.push(scheduledFor ? `/calendar?date=${scheduledFor}` : `/inbox?campaign=${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const native = PLATFORMS.filter((p) => PLATFORM_RULES[p].adapter === "native");
  const viaLate = PLATFORMS.filter((p) => PLATFORM_RULES[p].adapter === "late");
  const count = (s.platforms?.length ?? 0) * (s.candidatesPerSlot ?? 2);

  return (
    <form onSubmit={submit} className="">
      <PageTitle sub="One brief in, platform-native candidates out. Settings here override your workspace defaults.">New campaign</PageTitle>
      <div className="grid grid-cols-12 items-start gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-12 flex min-h-[600px] flex-col gap-5 rounded-[var(--radius)] border border-line bg-elev p-6 shadow-card xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-serif text-2xl">The brief</div>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-sm text-fg-muted transition-colors hover:border-line-strong">
              <CalendarDays size={16} className="text-accent-strong dark:text-accent" />
              <span>{scheduledFor ? "Scheduled for" : "Schedule for a day"}</span>
              <input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="cursor-pointer bg-transparent text-fg outline-none" />
              {scheduledFor && <button type="button" onClick={() => setScheduledFor("")} className="text-xs text-fg-subtle hover:text-fg">clear</button>}
            </label>
          </div>
          <Field label="What should we post about?">
            <Textarea required rows={10} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[220px] font-serif text-xl leading-relaxed" placeholder="Launch of our monthly coffee subscription: first box ships free, beans roasted 48h before shipping, cancel anytime." />
          </Field>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <Label hint="optional">Reference images or a video</Label>
              <div className="mt-1.5"><Dropzone files={files} onChange={setFiles} /></div>
            </div>
            <Field label="Reference links" hint="one per line"><Textarea rows={6} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://…" /></Field>
          </div>
          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</motion.p>}
          <div className="mt-auto flex flex-wrap items-center gap-4">
            <Button type="submit" variant="accent" size="lg" loading={!!busy} disabled={!prompt.trim() || !(s.platforms?.length)}>{busy ?? `Generate ${count} candidates`}</Button>
            <span className="text-sm text-fg-subtle">{s.platforms?.length ?? 0} platforms × {s.candidatesPerSlot ?? 2} candidates</span>
          </div>
        </motion.div>

        <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="col-span-12 h-fit space-y-5 rounded-[var(--radius)] border border-line bg-elev p-6 shadow-card xl:col-span-4">
          <div className="font-serif text-xl">Settings for this request</div>
          <div>
            <Label>Platforms · native</Label>
            <div className="mt-2 flex flex-wrap gap-2">{native.map((p) => <Chip key={p} label={PLATFORM_RULES[p].label} on={!!s.platforms?.includes(p)} onClick={() => togglePlatform(p)} />)}</div>
            <Label className="mt-4">Platforms · via Late</Label>
            <div className="mt-2 flex flex-wrap gap-2">{viaLate.map((p) => <Chip key={p} label={PLATFORM_RULES[p].label} on={!!s.platforms?.includes(p)} onClick={() => togglePlatform(p)} />)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posts"><Input type="number" min={1} max={10} value={s.postsCount ?? 3} onChange={(e) => setS({ ...s, postsCount: Number(e.target.value) })} /></Field>
            <Field label="Videos"><Input type="number" min={0} max={5} value={s.videosCount ?? 1} onChange={(e) => setS({ ...s, videosCount: Number(e.target.value) })} /></Field>
            <Field label="Hashtags"><Input type="number" min={0} max={30} value={s.hashtagCount ?? 5} onChange={(e) => setS({ ...s, hashtagCount: Number(e.target.value) })} /></Field>
            <Field label="Candidates / slot"><Select value={s.candidatesPerSlot ?? 2} onChange={(e) => setS({ ...s, candidatesPerSlot: Number(e.target.value) as 2 | 3 })}><option value={2}>2</option><option value={3}>3</option></Select></Field>
            <Field label="Video length"><Select value={s.videoLength ?? "30"} onChange={(e) => setS({ ...s, videoLength: e.target.value as "15" | "30" | "60" })}><option value="15">15s</option><option value="30">30s</option><option value="60">60s</option></Select></Field>
            <Field label="Voice"><Select value={s.voice ?? "Kore"} onChange={(e) => setS({ ...s, voice: e.target.value })}>{["Kore", "Puck", "Charon", "Aoede", "Fenrir"].map((v) => <option key={v}>{v}</option>)}</Select></Field>
          </div>
          <Field label="Tone"><Input value={s.tone ?? ""} onChange={(e) => setS({ ...s, tone: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Language"><Input value={s.language ?? "en"} onChange={(e) => setS({ ...s, language: e.target.value })} /></Field>
            <Field label="CTA" hint="optional"><Input value={s.cta ?? ""} onChange={(e) => setS({ ...s, cta: e.target.value || undefined })} placeholder="Start your first box" /></Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={!!s.allowAiBroll} onChange={(e) => setS({ ...s, allowAiBroll: e.target.checked })} />Allow AI-generated b-roll <span className="text-fg-subtle">(uses daily quota)</span></label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted"><input type="checkbox" className="accent-[var(--accent)]" checked={saveDefaults} onChange={(e) => setSaveDefaults(e.target.checked)} />Save these as workspace defaults</label>
        </motion.aside>
      </div>
    </form>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onClick} aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-xs transition-colors duration-200 ${on ? "border-fg bg-fg text-bg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg"}`}>
      {label}
    </motion.button>
  );
}
