"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(mode: "signIn" | "signUp") {
    setBusy(true); setError(null);
    const supabase = createBrowserSupabase();
    const { error } = mode === "signIn"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/inbox");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-50 px-4">
      <form onSubmit={(e) => { e.preventDefault(); go("signIn"); }} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-neutral-200 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Postpilot</h1>
          <p className="text-sm text-neutral-500">Sign in to your workspace.</p>
        </div>
        <label className="block text-sm">Email
          <input className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">Password
          <input className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="flex-1 rounded-lg bg-neutral-900 text-white py-2 disabled:opacity-50">Sign in</button>
          <button type="button" disabled={busy} onClick={() => go("signUp")} className="flex-1 rounded-lg border border-neutral-300 py-2 disabled:opacity-50">Create account</button>
        </div>
      </form>
    </main>
  );
}
