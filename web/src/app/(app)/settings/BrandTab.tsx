"use client";
import { useState, useTransition } from "react";
import { renameBrand } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";

export function BrandTab({ brandId, name }: { brandId: string; name: string }) {
  const [value, setValue] = useState(name);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = value.trim().length >= 2 && value.trim() !== name;
  return (
    <Card className="p-6">
      <form onSubmit={(e) => { e.preventDefault(); if (changed) setConfirm(true); }} className="max-w-md space-y-4">
        <Field label="Brand name" hint="used in every prompt"><Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} /></Field>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
        <Button type="submit" variant="accent" disabled={!changed}>Rename brand</Button>
      </form>
      <Dialog open={confirm} onOpenChange={setConfirm} title="Rename brand?" description={`“${name}” becomes “${value.trim()}”. Past drafts keep the old name; new prompts use the new one.`}>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="accent" loading={pending} onClick={() => start(async () => { const r = await renameBrand(brandId, value); setConfirm(false); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Brand renamed." }); })}>Confirm</Button>
        </div>
      </Dialog>
    </Card>
  );
}
