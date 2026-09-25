"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { updateProfile } from "@/lib/auth/profile";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";

export function ProfileTab({ displayName, email, avatarUrl }: { displayName: string; email: string; avatarUrl: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [emailValue, setEmailValue] = useState(email);
  const emailChanged = emailValue.trim().toLowerCase() !== email.toLowerCase();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="p-6">
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await updateProfile(fd); setMsg(r.ok ? { ok: true, text: "Profile saved." } : { ok: false, text: r.error }); if (r.ok) router.refresh(); }); }} className="space-y-6">
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative cursor-pointer rounded-full">
            <Avatar name={displayName || email} src={preview} size={72} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-fg/50 text-bg opacity-0 transition-opacity group-hover:opacity-100"><Camera size={20} /></span>
          </button>
          <div>
            <div className="font-medium">Profile photo</div>
            <p className="text-sm text-fg-muted">PNG or JPG, under 2 MB. Shown in the top bar.</p>
            <input ref={fileRef} name="avatar" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => fileRef.current?.click()}>Change photo</Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name"><Input name="displayName" defaultValue={displayName} required minLength={2} maxLength={60} /></Field>
          <Field label="Email"><Input name="email" type="email" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} required /></Field>
        </div>
        {emailChanged && (
          <Field label="Current password" hint="required to change your email"><Input name="currentPassword" type="password" autoComplete="current-password" required /></Field>
        )}
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</p>}
        <Button type="submit" variant="accent" loading={pending}>Save profile</Button>
      </form>
    </Card>
  );
}
