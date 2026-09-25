"use client";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";

export function ApprovalActions({ token }: { token: string }) {
  const [mode, setMode] = useState<"idle" | "changes" | "done">("idle");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const decide = (action: "approve" | "reject") => start(async () => {
    setError(null);
    const r = await fetch(`/api/approvals/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note: action === "reject" ? note : undefined }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Something went wrong. Ask for a new link.");
    setResult(action === "approve" ? "Approved. It is on the calendar now." : "Thanks. A revised version is being prepared with your note.");
    setMode("done");
  });

  return (
    <div className="mt-6">
      <AnimatePresence mode="wait" initial={false}>
        {mode === "done" ? (
          <motion.p key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">{result}</motion.p>
        ) : (
          <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {mode === "changes" && (
              <Field label="What should change?" hint="Your note is used word for word when the post is rewritten.">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Shorter, and drop the discount mention." autoFocus />
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              {mode === "idle" ? (<>
                <Button variant="accent" loading={pending} onClick={() => decide("approve")}><Check size={16} /> Approve</Button>
                <Button variant="secondary" disabled={pending} onClick={() => setMode("changes")}><MessageSquareText size={16} /> Request changes</Button>
              </>) : (<>
                <Button variant="accent" loading={pending} disabled={note.trim().length < 3} onClick={() => decide("reject")}>Send note</Button>
                <Button variant="ghost" disabled={pending} onClick={() => setMode("idle")}>Back</Button>
              </>)}
            </div>
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
