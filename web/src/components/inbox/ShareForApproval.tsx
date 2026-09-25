"use client";
import { useState, useTransition } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { Tooltip } from "@/components/ui/Tooltip";

type ShareResult = { url: string; expiresAt: string; emailed: boolean; approverEmail: string | null };

/** "Share for approval": issues a login-free link (and emails it when an approver is set) for a draft still in review. */
export function ShareForApproval({ draftId, disabled }: { draftId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<ShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const share = () => start(async () => {
    setError(null); setRes(null); setOpen(true);
    const r = await fetch(`/api/drafts/${draftId}/share`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Could not create a link");
    setRes(j as ShareResult);
  });
  const copy = async () => { if (!res) return; try { await navigator.clipboard.writeText(res.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setError("Copy failed; select the link and copy it manually."); } };
  const status = !res ? null : res.emailed ? `Emailed to ${res.approverEmail}.` : res.approverEmail ? "Email is not configured on this deployment; share the link directly." : "Add an approver email in the brand kit to send it automatically.";

  return (
    <>
      <Tooltip label="Get a login-free link a client can approve from"><span><Button size="sm" variant="ghost" onClick={share} disabled={disabled} loading={pending}><Link2 size={14} /> Share for approval</Button></span></Tooltip>
      <Dialog open={open} onOpenChange={setOpen} title="Approval link" description="Works once, expires in 72 hours, and is tied to this version of the post.">
        <div className="space-y-3">
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          {res && (<>
            <div className="flex gap-2"><Input readOnly value={res.url} onFocus={(e) => e.currentTarget.select()} /><Button variant="secondary" onClick={copy}><Copy size={14} /> {copied ? "Copied" : "Copy"}</Button></div>
            <p className="text-xs text-fg-subtle">Expires {new Date(res.expiresAt).toLocaleString()}</p>
            <p className="text-sm text-fg-muted">{status}</p>
          </>)}
          {!res && !error && <p className="text-sm text-fg-muted">Creating the link…</p>}
        </div>
      </Dialog>
    </>
  );
}
