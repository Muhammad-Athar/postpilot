"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { saveBrand } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Eyebrow } from "@/components/ui/Heading";
import { Stagger, Item } from "@/components/ui/Motion";
import type { BrandKit } from "@/lib/brand/schema";

type Props = { brandName: string; kit: BrandKit; bannedWords: string[]; voiceProfile: string; onboarding: boolean };
const card = "h-full rounded-[var(--radius)] border border-line bg-elev p-5 shadow-card";
const swatchOk = (c: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());

export function BrandKitForm({ brandName, kit, bannedWords, voiceProfile, onboarding }: Props) {
  const [dirty, setDirty] = useState(false);
  const [colors, setColors] = useState(kit.colors.join(", "));
  const [logo, setLogo] = useState<string | null>(kit.logoUrl ?? null);
  const [banner, setBanner] = useState(onboarding);
  const [pending, start] = useTransition();
  const swatches = colors.split(",").map((c) => c.trim()).filter(swatchOk);

  return (
    <form action={(fd) => start(async () => { await saveBrand(fd); setDirty(false); })} onChange={() => setDirty(true)} className="space-y-6">
      <AnimatePresence>
        {banner && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-accent/40 bg-accent-soft/50 px-5 py-4">
            <Sparkles size={18} className="text-accent-strong dark:text-accent" />
            <div className="min-w-0 flex-1">
              <div className="font-serif text-xl">Welcome. Tell it who you are.</div>
              <p className="text-sm text-fg-muted">Fill in what you can. Every field here makes the output sound more like you. You can skip this and come back any time.</p>
            </div>
            <Link href="/inbox"><Button type="button" variant="secondary" size="sm">Skip for now → Inbox</Button></Link>
            <button type="button" onClick={() => setBanner(false)} aria-label="Dismiss" className="rounded-lg p-1 text-fg-subtle hover:bg-muted hover:text-fg"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <Stagger className="grid grid-cols-12 gap-4">
        <Item className="col-span-12 xl:col-span-7">
          <div className={card}>
            <Eyebrow>Identity</Eyebrow>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Brand name"><Input name="name" defaultValue={brandName} required /></Field>
              <Field label="Tagline"><Input name="tagline" defaultValue={kit.tagline} placeholder="Coffee that ships itself" /></Field>
            </div>
            <div className="mt-4"><Field label="What you do" hint="1–2 sentences"><Textarea name="description" defaultValue={kit.description} rows={2} placeholder="Monthly specialty coffee subscription, roasted to order." /></Field></div>
          </div>
        </Item>
        <Item className="col-span-12 xl:col-span-5">
          <aside className="h-full rounded-[var(--radius)] bg-fg p-5 text-bg shadow-lift">
            <Eyebrow>Voice profile</Eyebrow>
            <p className="mt-1 text-xs text-bg/60">This exact text rides along with every prompt.</p>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-serif text-[15px] leading-relaxed">{voiceProfile || "Save the kit to generate a voice profile."}</pre>
          </aside>
        </Item>

        <Item className="col-span-12 md:col-span-6 xl:col-span-4">
          <div className={card}>
            <Eyebrow>Audience & tone</Eyebrow>
            <div className="mt-3 space-y-4">
              <Field label="Audience"><Input name="audience" defaultValue={kit.audience} placeholder="remote workers 25-40 who care about coffee" /></Field>
              <Field label="Tone words" hint="comma-separated"><Input name="toneWords" defaultValue={kit.toneWords.join(", ")} placeholder="warm, witty, specific" /></Field>
            </div>
          </div>
        </Item>
        <Item className="col-span-12 md:col-span-6 xl:col-span-4">
          <div className={card}>
            <Eyebrow>Calls to action & hashtags</Eyebrow>
            <div className="mt-3 space-y-4">
              <Field label="Default CTA"><Input name="defaultCta" defaultValue={kit.defaultCta ?? ""} placeholder="Start your first box" /></Field>
              <Field label="Hashtag sets" hint="one set per line"><Textarea name="hashtagSets" defaultValue={kit.hashtagSets.join("\n")} rows={2} placeholder="#specialtycoffee #wfh #morningritual" /></Field>
              <Field label="Approver email" hint="Receives approval links when you share a post for sign-off (agency mode)"><Input name="approverEmail" type="email" defaultValue={kit.approverEmail ?? ""} placeholder="client@example.com" /></Field>
            </div>
          </div>
        </Item>
        <Item className="col-span-12 xl:col-span-4">
          <div className={card}>
            <Eyebrow>Colours, fonts & logo</Eyebrow>
            <div className="mt-3 space-y-4">
              <Field label="Brand colours" hint="hex, comma-separated"><Input name="colors" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="#3B2F2F, #F3E9DC" /></Field>
              {swatches.length > 0 && <div className="flex flex-wrap gap-2">{swatches.map((c) => <span key={c} title={c} className="h-7 w-7 rounded-full ring-1 ring-line" style={{ background: c }} />)}</div>}
              <Field label="Fonts" hint="comma-separated"><Input name="fonts" defaultValue={kit.fonts.join(", ")} placeholder="Inter" /></Field>
              <label className="block">
                <span className="block text-[13px] font-medium">Logo <span className="font-normal text-fg-subtle">PNG/SVG/JPG</span></span>
                <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-bg p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo preview */}
                  {logo ? <img src={logo} alt="Logo" className="h-10 w-auto rounded" /> : <span className="grid h-10 w-10 place-items-center rounded bg-muted text-xs text-fg-subtle">Logo</span>}
                  <input name="logo" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogo(URL.createObjectURL(f)); }} className="min-w-0 flex-1 text-xs file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-fg file:px-3 file:py-1.5 file:text-xs file:text-bg" />
                </div>
              </label>
            </div>
          </div>
        </Item>

        <Item className="col-span-12 xl:col-span-8">
          <div className={card}>
            <Eyebrow>Sample posts in your voice</Eyebrow>
            <p className="mt-1 text-xs text-fg-subtle">One per line. Five to ten is ideal; these matter more than any tone word.</p>
            <Textarea name="samplePosts" defaultValue={kit.samplePosts.join("\n")} rows={6} className="mt-3 font-serif text-base" placeholder={"Monday, but make it Ethiopian.\nYour desk deserves better beans."} />
          </div>
        </Item>
        <Item className="col-span-12 xl:col-span-4">
          <div className={card}>
            <Eyebrow>Banned words</Eyebrow>
            <p className="mt-1 text-xs text-fg-subtle">Never appear in any draft.</p>
            <Textarea name="bannedWords" defaultValue={bannedWords.join(", ")} rows={6} className="mt-3" placeholder="cheap, hack, game-changer" />
          </div>
        </Item>
      </Stagger>

      <AnimatePresence>
        {(dirty || onboarding) && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-[var(--radius)] border border-line bg-elev/90 px-5 py-3 shadow-lift backdrop-blur">
            <span className="text-sm text-fg-muted">{dirty ? "You have unsaved changes." : "Save when you're ready."}</span>
            <Button type="submit" variant="accent" loading={pending}>Save brand kit</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
