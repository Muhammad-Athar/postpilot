import { getSession } from "@/lib/auth/session";
import { brandKitSchema } from "@/lib/brand/schema";
import { saveBrand } from "./actions";

const input = "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

export default async function BrandPage() {
  const { brand } = await getSession();
  const kit = brandKitSchema.parse(brand.kit ?? {});
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] max-w-5xl">
      <form action={saveBrand} className="space-y-4 rounded-2xl bg-white p-6 border border-neutral-200">
        <h1 className="text-2xl font-semibold tracking-tight">Brand kit</h1>
        <p className="text-sm text-neutral-500">Everything here is injected into every generation, so the output sounds like you and not like a model.</p>
        <label className="block text-sm">Brand name<input name="name" defaultValue={brand.name} className={input} required /></label>
        <label className="block text-sm">Tagline<input name="tagline" defaultValue={kit.tagline} className={input} /></label>
        <label className="block text-sm">What you do (1–2 sentences)<textarea name="description" defaultValue={kit.description} rows={2} className={input} /></label>
        <label className="block text-sm">Audience<input name="audience" defaultValue={kit.audience} placeholder="remote workers 25-40 who care about coffee" className={input} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Tone words (comma-separated)<input name="toneWords" defaultValue={kit.toneWords.join(", ")} placeholder="warm, witty, specific" className={input} /></label>
          <label className="block text-sm">Default CTA<input name="defaultCta" defaultValue={kit.defaultCta ?? ""} placeholder="Start your first box" className={input} /></label>
          <label className="block text-sm">Brand colours (hex, comma-separated)<input name="colors" defaultValue={kit.colors.join(", ")} placeholder="#3B2F2F, #F3E9DC" className={input} /></label>
          <label className="block text-sm">Fonts (comma-separated)<input name="fonts" defaultValue={kit.fonts.join(", ")} placeholder="Inter" className={input} /></label>
        </div>
        <label className="block text-sm">Logo (PNG/SVG/JPG)
          <input name="logo" type="file" accept="image/*" className="mt-1 block text-sm" />
          {/* eslint-disable-next-line @next/next/no-img-element -- remote logo preview, not worth an image loader */}
          {kit.logoUrl && <img src={kit.logoUrl} alt="Current logo" className="mt-2 h-12 w-auto rounded" />}
        </label>
        <label className="block text-sm">Sample posts in your voice (one per line, 5–10 is ideal)<textarea name="samplePosts" defaultValue={kit.samplePosts.join("\n")} rows={5} className={input} /></label>
        <label className="block text-sm">Hashtag sets (one set per line)<textarea name="hashtagSets" defaultValue={kit.hashtagSets.join("\n")} rows={2} className={input} placeholder="#specialtycoffee #wfh #morningritual" /></label>
        <label className="block text-sm">Banned words (comma-separated)<input name="bannedWords" defaultValue={brand.banned_words.join(", ")} placeholder="cheap, hack, game-changer" className={input} /></label>
        <button className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm">Save brand kit</button>
      </form>
      <aside className="rounded-2xl bg-neutral-900 text-neutral-100 p-6 h-fit">
        <div className="text-xs uppercase tracking-wide text-neutral-400">Voice profile preview</div>
        <p className="mt-2 text-xs text-neutral-400">This exact text is sent with every prompt.</p>
        <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{brand.voice_profile || "Save the kit to generate a voice profile."}</pre>
      </aside>
    </div>
  );
}
