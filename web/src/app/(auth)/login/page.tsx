"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"signIn" | "signUp" | null>(null);

  async function go(mode: "signIn" | "signUp") {
    setBusy(mode); setError(null);
    const supabase = createBrowserSupabase();
    const { error } = mode === "signIn" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(null);
    if (error) return setError(error.message);
    router.replace("/inbox"); router.refresh();
  }

  return (
    <main className="relative z-10 grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-muted/40 p-10 md:flex md:flex-col md:justify-between">
        <Link href="/" className="font-serif text-2xl">Postpilot</Link>
        <div>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-md font-serif text-4xl leading-tight">
            “It stopped sounding like a robot after the third rejection.”
          </motion.p>
          <p className="mt-4 text-sm text-fg-muted">Every decision you make in the inbox becomes part of the brief.</p>
        </div>
        <div className="text-xs text-fg-subtle">Demo workspace · free tiers only</div>
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" aria-hidden />
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} onSubmit={(e) => { e.preventDefault(); go("signIn"); }} className="w-full max-w-sm space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-3xl">Welcome back</h1>
              <p className="mt-1 text-sm text-fg-muted">Sign in, or create a workspace in one step.</p>
            </div>
            <ThemeToggle />
          </div>
          <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" /></Field>
          <Field label="Password" hint="6+ characters"><Input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</motion.p>}
          <div className="flex gap-2">
            <Button type="submit" variant="accent" loading={busy === "signIn"} disabled={!!busy} block>Sign in</Button>
            <Button type="button" variant="secondary" loading={busy === "signUp"} disabled={!!busy} block onClick={() => go("signUp")}>Create account</Button>
          </div>
          <p className="text-center text-xs text-fg-subtle"><Link href="/" className="underline-offset-2 hover:underline">Back to site</Link></p>
        </motion.form>
      </section>
    </main>
  );
}
