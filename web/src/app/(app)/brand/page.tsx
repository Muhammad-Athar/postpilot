import { getSession } from "@/lib/auth/session";
import { brandKitSchema } from "@/lib/brand/schema";
import { saveBrand } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageTitle, Eyebrow } from "@/components/ui/Heading";
import { Stagger, Item } from "@/components/ui/Motion";

export default async function BrandPage() {
  const { brand } = await getSession();
  const kit = brandKitSchema.parse(brand.kit ?? {});
  return (
    <div className="max-w-6xl">
      <PageTitle sub="Everything here rides along with every prompt, so the output sounds like you and not like a model.">Brand kit</PageTitle>
      <Stagger className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Item>
          <form action={saveBrand} className="space-y-5 rounded-[var(--radius)] border border-line bg-elev p-6 shadow-card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand name"><Input name="name" defaultValue={brand.name} required /></Field>
              <Field label="Tagline"><Input name="tagline" defaultValue={kit.tagline} /></Field>
            </div>
            <Field label="What you do" hint="1–2 sentences"><Textarea name="description" defaultValue={kit.description} rows={2} /></Field>
            <Field label="Audience"><Input name="audience" defaultValue={kit.audience} placeholder="remote workers 25-40 who care about coffee" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tone words" hint="comma-separated"><Input name="toneWords" defaultValue={kit.toneWords.join(", ")} placeholder="warm, witty, specific" /></Field>
              <Field label="Default CTA"><Input name="defaultCta" defaultValue={kit.defaultCta ?? ""} placeholder="Start your first box" /></Field>
              <Field label="Brand colours" hint="hex, comma-separated"><Input name="colors" defaultValue={kit.colors.join(", ")} placeholder="#3B2F2F, #F3E9DC" /></Field>
              <Field label="Fonts" hint="comma-separated"><Input name="fonts" defaultValue={kit.fonts.join(", ")} placeholder="Inter" /></Field>
            </div>
            <label className="block">
              <span className="block text-[13px] font-medium">Logo <span className="font-normal text-fg-subtle">PNG/SVG/JPG</span></span>
              <div className="mt-1.5 flex items-center gap-4 rounded-xl border border-dashed border-line-strong bg-bg p-4">
                {kit.logoUrl &&   <img src={kit.logoUrl} alt="Current logo" className="h-12 w-auto rounded" />}
                <input name="logo" type="file" accept="image/*" className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-fg file:px-3 file:py-1.5 file:text-xs file:text-bg" />
              </div>
            </label>
            <Field label="Sample posts in your voice" hint="one per line, 5–10 is ideal"><Textarea name="samplePosts" defaultValue={kit.samplePosts.join("\n")} rows={6} className="font-serif text-base" /></Field>
            <Field label="Hashtag sets" hint="one set per line"><Textarea name="hashtagSets" defaultValue={kit.hashtagSets.join("\n")} rows={2} placeholder="#specialtycoffee #wfh #morningritual" /></Field>
            <Field label="Banned words" hint="comma-separated"><Input name="bannedWords" defaultValue={brand.banned_words.join(", ")} placeholder="cheap, hack, game-changer" /></Field>
            <Button type="submit" variant="accent">Save brand kit</Button>
          </form>
        </Item>
        <Item>
          <aside className="sticky top-6 rounded-[var(--radius)] bg-fg p-6 text-bg shadow-lift">
            <Eyebrow>Voice profile</Eyebrow>
            <p className="mt-1 text-xs text-bg/60">This exact text is sent with every prompt.</p>
            <pre className="mt-4 whitespace-pre-wrap font-serif text-[15px] leading-relaxed">{brand.voice_profile || "Save the kit to generate a voice profile."}</pre>
          </aside>
        </Item>
      </Stagger>
    </div>
  );
}
