"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlatformPreview } from "./PlatformPreview";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Field";
import type { DraftRow, DraftAction } from "@/lib/drafts/types";

export function DraftCard({ draft, referenceImage, onAction }: { draft: DraftRow; referenceImage?: string; onAction: (id: string, action: DraftAction, payload?: { note?: string; edits?: Record<string, unknown> }) => Promise<void> }) {
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [busy, setBusy] = useState<DraftAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [edits, setEdits] = useState({ hook: draft.hook, caption: draft.caption, hashtags: draft.hashtags.join(" "), firstComment: draft.first_comment ?? "", altText: draft.alt_text ?? "" });

  async function run(action: DraftAction, payload?: { note?: string; edits?: Record<string, unknown> }) {
    setBusy(action); setError(null);
    try { await onAction(draft.id, action, payload); setMode("view"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const locked = busy !== null || draft.status !== "draft";
  const tone = draft.status === "approved" || draft.status === "scheduled" ? "ok" : draft.status === "rejected" ? "neutral" : "warn";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: draft.status === "rejected" ? 0.55 : 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`grid gap-5 rounded-[var(--radius)] border bg-elev p-4 shadow-card md:grid-cols-[270px_1fr] ${draft.status === "approved" || draft.status === "scheduled" ? "border-ok/50" : "border-line"}`}
    >
      <PlatformPreview draft={draft} referenceImage={referenceImage} />
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Candidate {draft.candidate_index + 1}</Badge>
          <Badge tone={draft.parent_draft_id ? "accent" : "neutral"}>v{draft.version}{draft.parent_draft_id ? " · regenerated" : ""}</Badge>
          <Badge tone={tone}>{draft.status}</Badge>
        </div>
        <AnimatePresence initial={false}>
          {draft.change_notes.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-3 text-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-accent-strong dark:text-accent">What changed</div>
                <ul className="mt-1 list-disc pl-4 text-fg">{draft.change_notes.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div>
          {mode === "edit" ? (
            <motion.div key="edit" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <Field label="Hook"><Input value={edits.hook} onChange={(e) => setEdits({ ...edits, hook: e.target.value })} /></Field>
              <Field label="Caption"><Textarea rows={5} value={edits.caption} onChange={(e) => setEdits({ ...edits, caption: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hashtags" hint="space-separated"><Input value={edits.hashtags} onChange={(e) => setEdits({ ...edits, hashtags: e.target.value })} /></Field>
                <Field label="First comment"><Input value={edits.firstComment} onChange={(e) => setEdits({ ...edits, firstComment: e.target.value })} /></Field>
              </div>
              <Field label="Alt text"><Input value={edits.altText} onChange={(e) => setEdits({ ...edits, altText: e.target.value })} /></Field>
            </motion.div>
          ) : mode === "reject" ? (
            <motion.div key="reject" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Field label="What's wrong?" hint="optional"><Textarea rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell it what's wrong, or leave blank and let it infer from your history." /></Field>
            </motion.div>
          ) : (
            <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <p className="font-serif text-2xl leading-tight">{draft.hook}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{draft.caption.startsWith(draft.hook) ? draft.caption.slice(draft.hook.length).trim() : draft.caption}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-subtle">
                <span>Media · {draft.media_plan.kind.replace(/_/g, " ")}</span>
                {draft.hashtags.length > 0 && <span>{draft.hashtags.length} hashtags</span>}
                {draft.alt_text && <span className="basis-full truncate">Alt · {draft.alt_text}</span>}
              </div>
            </motion.div>
          )}
        </div>
        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</motion.p>}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {mode === "view" && (<>
            <Button size="sm" variant="accent" disabled={locked} loading={busy === "approve"} onClick={() => run("approve")}>Approve</Button>
            <Button size="sm" variant="secondary" disabled={locked} onClick={() => setMode("edit")}>Edit</Button>
            <Button size="sm" variant="secondary" disabled={locked} onClick={() => setMode("reject")}>Reject</Button>
            <Button size="sm" variant="ghost" disabled={locked} loading={busy === "regenerate"} onClick={() => run("regenerate")}>↻ Regenerate</Button>
          </>)}
          {mode === "edit" && (<>
            <Button size="sm" disabled={locked} loading={busy === "edit"} onClick={() => run("edit", { edits: { hook: edits.hook, caption: edits.caption, hashtags: edits.hashtags.split(/\s+/).filter(Boolean), firstComment: edits.firstComment || null, altText: edits.altText || null } })}>Save edits</Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setMode("view")}>Cancel</Button>
          </>)}
          {mode === "reject" && (<>
            <Button size="sm" disabled={locked} loading={busy === "reject"} onClick={() => run("reject", { note })}>Reject &amp; regenerate</Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setMode("view")}>Cancel</Button>
          </>)}
        </div>
      </div>
    </motion.div>
  );
}
