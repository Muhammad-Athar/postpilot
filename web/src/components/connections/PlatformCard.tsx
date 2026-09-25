"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Unplug } from "lucide-react";
import { PLATFORM_RULES, type Platform } from "@/lib/platforms/rules";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Tooltip } from "@/components/ui/Tooltip";

export type Connection = { platform: Platform; external_id: string | null; status: "ok" | "reconnect" | "error" };
const HELP: Partial<Record<Platform, string>> = {
  bluesky: "Settings → Privacy and security → App passwords in the Bluesky app. Never your main password.",
  mastodon: "Preferences → Development → New application (write:statuses, read:accounts) on your instance, then copy the access token.",
};

export function PlatformCard({ platform, connection }: { platform: Platform; connection?: Connection }) {
  const r = PLATFORM_RULES[platform];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canConnect = platform === "bluesky" || platform === "mastodon";
  const connected = connection?.status === "ok";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = platform === "bluesky" ? { platform, handle: fd.get("handle"), appPassword: fd.get("appPassword") } : { platform, instance: fd.get("instance"), accessToken: fd.get("accessToken") };
    start(async () => {
      const res = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) return setError(j.error ?? "Could not connect");
      setOpen(false); router.refresh();
    });
  }
  function disconnect() { start(async () => { await fetch("/api/connections", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform }) }); router.refresh(); }); }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} className={`flex flex-col gap-3 rounded-[var(--radius)] border bg-elev p-5 shadow-card ${connected ? "border-ok/50" : "border-line"}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft font-serif text-lg text-accent-strong dark:text-accent">{r.label[0]}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{r.label}</div>
          <div className="text-xs text-fg-subtle">{r.adapter === "native" ? "Native adapter" : "Via Late"} · {r.aspect}</div>
        </div>
        <Badge tone={connected ? "ok" : connection?.status === "reconnect" ? "warn" : "neutral"}>{connected ? "Connected" : connection?.status === "reconnect" ? "Reconnect" : "Not connected"}</Badge>
      </div>
      {connected && <div className="flex items-center gap-2 text-sm text-fg-muted"><Check size={14} className="text-ok" /> {connection?.external_id}</div>}
      <div className="mt-auto flex gap-2">
        {connected ? (
          <Button size="sm" variant="secondary" loading={pending} onClick={disconnect}><Unplug size={14} /> Disconnect</Button>
        ) : canConnect ? (
          <Button size="sm" variant="accent" onClick={() => setOpen(true)}>Connect</Button>
        ) : (
          <Tooltip label={r.adapter === "native" ? "Meta app review is in progress; arrives with publishing." : "Arrives with publishing via Late."}><span><Button size="sm" variant="secondary" disabled>Connect</Button></span></Tooltip>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen} title={`Connect ${r.label}`} description={HELP[platform]}>
        <form onSubmit={submit} className="space-y-4">
          {platform === "bluesky" ? (<>
            <Field label="Handle"><Input name="handle" placeholder="you.bsky.social" required autoComplete="off" /></Field>
            <Field label="App password"><Input name="appPassword" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" required autoComplete="off" /></Field>
          </>) : (<>
            <Field label="Instance URL"><Input name="instance" placeholder="https://mastodon.social" required /></Field>
            <Field label="Access token"><Input name="accessToken" type="password" required autoComplete="off" /></Field>
          </>)}
          <p className="text-xs text-fg-subtle">Stored encrypted. Used only to publish approved posts and read their metrics.</p>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="accent" loading={pending}>Connect</Button></div>
        </form>
      </Dialog>
    </motion.div>
  );
}
