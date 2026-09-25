"use client";
import { useState, useTransition } from "react";
import { changePassword } from "@/lib/auth/profile";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";

export function PasswordTab() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="p-6">
      <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); start(async () => { const r = await changePassword(fd); setMsg(r.ok ? { ok: true, text: "Password changed." } : { ok: false, text: r.error }); if (r.ok) form.reset(); }); }} className="max-w-md space-y-4">
        <Field label="Current password"><Input name="current" type="password" autoComplete="current-password" required /></Field>
        <Field label="New password" hint="8+ characters"><Input name="next" type="password" autoComplete="new-password" required minLength={8} /></Field>
        <Field label="Confirm new password"><Input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></Field>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
        <Button type="submit" variant="accent" loading={pending}>Change password</Button>
      </form>
    </Card>
  );
}
