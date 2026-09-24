import Link from "next/link";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks, PlatformStrip, Differentiators, LoopDiagram } from "@/components/landing/Sections";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="font-serif text-2xl tracking-tight">Postpilot</div>
          <nav className="hidden items-center gap-6 text-sm text-fg-muted md:flex">
            <a href="#how" className="transition-colors hover:text-fg">How it works</a>
            <a href="#why" className="transition-colors hover:text-fg">Why</a>
            <a href="https://github.com/Muhammad-Athar/postpilot" className="transition-colors hover:text-fg" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login"><Button size="sm">Sign in</Button></Link>
          </div>
        </div>
      </header>
      <Hero />
      <PlatformStrip />
      <div id="how"><HowItWorks /></div>
      <div id="why"><Differentiators /></div>
      <LoopDiagram />
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-fg-subtle">
          <span className="font-serif text-lg text-fg">Postpilot</span>
          <span>Open source · MIT · Built on Next.js, Supabase, n8n and Gemini</span>
        </div>
      </footer>
    </main>
  );
}
