"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

export function SyncNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = () => start(async () => {
    setMsg(null);
    const r = await fetch("/api/analytics/sync"); const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg("Sync failed.");
    const errors = (j.errors as string[] | undefined) ?? [];
    setMsg(errors.length ? errors[0] : `Synced ${j.accounts} account${j.accounts === 1 ? "" : "s"}, ${j.posts} post${j.posts === 1 ? "" : "s"}.`);
    router.refresh();
  });
  return (
    <span className="inline-flex items-center gap-3">
      <Tooltip label="Pull the latest numbers from every connected platform"><span><Button size="sm" variant="secondary" loading={pending} onClick={run}><RefreshCw size={14} /> Sync now</Button></span></Tooltip>
      {msg && <span className="text-xs text-fg-muted">{msg}</span>}
    </span>
  );
}
