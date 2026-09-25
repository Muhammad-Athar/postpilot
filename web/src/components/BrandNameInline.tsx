"use client";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { renameBrand } from "@/app/(app)/actions";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Tooltip } from "@/components/ui/Tooltip";

export function BrandNameInline({ brandId, name }: { brandId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = value.trim() && value.trim() !== name;
  return (
    <>
      <Tooltip label="Rename this brand" side="right">
        <button onClick={() => { setValue(name); setError(null); setOpen(true); }} className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-bg px-3 py-2 text-left text-sm transition-colors hover:border-line-strong">
          <span className="truncate"><span className="text-fg-subtle">Brand · </span>{name}</span>
          <Pencil size={14} className="shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen} title="Rename brand" description="The name is part of every prompt from now on, so past drafts keep the old one.">
        <form onSubmit={(e) => { e.preventDefault(); if (!changed) return; start(async () => { const r = await renameBrand(brandId, value); if (r?.error) setError(r.error); else setOpen(false); }); }} className="space-y-4">
          <Field label="New name"><Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} /></Field>
          {changed && <p className="text-sm text-fg-muted">Rename <span className="font-medium text-fg">“{name}”</span> to <span className="font-medium text-fg">“{value.trim()}”</span>?</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="accent" disabled={!changed} loading={pending}>Rename</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
