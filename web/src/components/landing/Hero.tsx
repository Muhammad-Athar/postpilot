"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Heading";

const CARDS = [
  { platform: "Instagram", hook: "Monday, but make it Ethiopian.", tone: "warm", status: "Approved" },
  { platform: "LinkedIn", hook: "We roast 48 hours before we ship. Here is why that matters.", tone: "insight", status: "v2 · regenerated" },
  { platform: "TikTok", hook: "POV: your desk smells better than the café.", tone: "playful", status: "Rendering short" },
];

const BASE_ROT = [-4, 2, -1];
export function Hero() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-24">
      <div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Eyebrow>Social content, edited by you, learned by it</Eyebrow>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }} className="mt-5 font-serif text-[2.9rem] leading-[1.02] tracking-[-0.015em] sm:text-6xl">
          Give it an idea, a photo, <em className="italic text-accent-strong dark:text-accent">or a video.</em>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }} className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
          Postpilot writes and renders platform-native posts and Shorts, learns your taste from every approval, publishes on your schedule, and tells you what actually worked.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }} className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/login"><Button variant="accent" size="lg">Try the demo</Button></Link>
          <a href="https://github.com/Muhammad-Athar/postpilot" target="_blank" rel="noreferrer"><Button variant="secondary" size="lg">Source on GitHub</Button></a>
          <span className="ml-1 text-sm text-fg-subtle">Free tiers only · no card</span>
        </motion.div>
      </div>

      <div className="relative h-[440px]">
        <div className="absolute -inset-10 -z-10 rounded-full bg-accent-soft/60 blur-3xl dark:bg-accent-soft/40" aria-hidden />
        {CARDS.map((c, i) => (
          <motion.div
            key={c.platform}
            initial={{ opacity: 0, y: 40, rotate: 0 }}
            animate={{ opacity: 1, y: active === i ? -10 : 0, rotate: active === i ? 0 : BASE_ROT[i], scale: active === i ? 1.02 : 1 }}
            transition={{ opacity: { duration: 0.7, delay: 0.3 + i * 0.12 }, type: "spring", stiffness: 220, damping: 24, mass: 0.8 }}
            onHoverStart={() => setActive(i)}
            onHoverEnd={() => setActive(null)}
            className="absolute left-0 right-0 mx-auto w-[88%] cursor-pointer rounded-[var(--radius)] border border-line bg-elev p-5 shadow-lift will-change-transform"
            style={{ top: `${i * 128}px`, zIndex: active === i ? 10 : i }}
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-fg-subtle">
              <span>{c.platform}</span>
              <span className={`rounded-full px-2 py-0.5 ${c.status.startsWith("Approved") ? "bg-ok-soft text-ok" : c.status.startsWith("v2") ? "bg-accent-soft text-accent-strong dark:text-accent" : "bg-info-soft text-info"}`}>{c.status}</span>
            </div>
            <p className="mt-2 font-serif text-[1.35rem] leading-tight">{c.hook}</p>
            <div className="mt-4 flex gap-2">
              {["Approve", "Edit", "Regenerate"].map((b) => <span key={b} className="rounded-lg border border-line px-2.5 py-1 text-xs text-fg-muted">{b}</span>)}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
