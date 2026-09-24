"use client";
import { motion } from "framer-motion";
import { Reveal } from "@/components/ui/Motion";
import { Eyebrow } from "@/components/ui/Heading";

const STEPS = [
  { n: "01", t: "Brief it", d: "A sentence, a product photo, a raw video, or a link. Set how many posts, which platforms, the tone, the length of the Short." },
  { n: "02", t: "Review candidates", d: "Two or three per platform, each with a different angle. Approve, edit in place, reject with a note, or just ask again." },
  { n: "03", t: "It learns", d: "Every approval, edit and rejection is stored. A bare “regenerate” makes visible, inferred changes and tells you what it changed." },
  { n: "04", t: "Publish & measure", d: "Approved items fill your cadence. Analytics explain what worked and feed the winners back into the next brief." },
];
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "YouTube Shorts", "LinkedIn", "X", "Threads", "Pinterest", "Bluesky", "Mastodon"];
const DIFFS = [
  { t: "Preference memory", d: "Not a tone dropdown. A running profile of what you actually approve, rebuilt every ten decisions." },
  { t: "Platform-native, not copy-pasted", d: "Different hook, length, hashtags and aspect ratio per platform. First-comment hashtags on Instagram. 280 on X." },
  { t: "Shorts, rendered", d: "Script → voice-over → footage → word-timed subtitles → 9:16 with safe zones. Your own clips first, stock second, AI b-roll optional." },
  { t: "Approve from your inbox", d: "Login-free approval links by email or Telegram. Single-use, expire in 72 hours, bound to the exact draft version." },
  { t: "Single brand or agency", d: "One setting flips the workspace between one brand and many, with per-brand kits and client approvals." },
  { t: "Analytics that explain", d: "Top posts by hook type, length, hour and format, with a one-click “more like this”." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal><Eyebrow>How it works</Eyebrow><h2 className="mt-3 font-serif text-4xl tracking-[-0.01em]">Four steps, one loop.</h2></Reveal>
      <div className="mt-10 grid gap-4 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="group h-full rounded-[var(--radius)] border border-line bg-elev p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-lift">
              <div className="font-serif text-3xl text-accent-strong dark:text-accent">{s.n}</div>
              <div className="mt-3 font-medium">{s.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function PlatformStrip() {
  const items = [...PLATFORMS, ...PLATFORMS];
  return (
    <section className="border-y border-line bg-muted/50 py-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <motion.div className="flex w-max gap-10 whitespace-nowrap" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 28, ease: "linear", repeat: Infinity }}>
          {items.map((p, i) => <span key={i} className="font-serif text-2xl text-fg-muted">{p}</span>)}
        </motion.div>
      </div>
    </section>
  );
}

export function Differentiators() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal><Eyebrow>Why it is different</Eyebrow><h2 className="mt-3 max-w-2xl font-serif text-4xl tracking-[-0.01em]">Most tools schedule. This one pays attention.</h2></Reveal>
      <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
        {DIFFS.map((d, i) => (
          <Reveal key={d.t} delay={(i % 3) * 0.08}>
            <div className="border-t border-line-strong pt-4">
              <div className="font-medium">{d.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function LoopDiagram() {
  const nodes = ["Brief", "Generate", "Review", "Learn", "Publish", "Measure"];
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <Reveal>
        <div className="rounded-[var(--radius)] border border-line bg-elev p-8 md:p-12">
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
            {nodes.map((n, i) => (
              <div key={n} className="flex items-center gap-3 md:gap-6">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="rounded-full border border-line-strong bg-bg px-5 py-2 font-serif text-xl">
                  {n}
                </motion.div>
                {i < nodes.length - 1 && <span className="text-fg-subtle">→</span>}
              </div>
            ))}
            <span className="text-fg-subtle">↺</span>
          </div>
          <p className="mt-6 text-center text-sm text-fg-muted">Measurement feeds the next brief. The loop is the product.</p>
        </div>
      </Reveal>
    </section>
  );
}
