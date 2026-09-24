"use client";
import { useState } from "react";
import { PlatformPreview } from "./PlatformPreview";
import type { DraftRow, DraftAction } from "@/lib/drafts/types";

const input = "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

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

  const disabled = busy !== null || draft.status !== "draft";
  return (
    <div className={`grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-[280px_1fr] ${draft.status === "approved" ? "border-emerald-300" : draft.status === "rejected" ? "border-neutral-200 opacity-60" : "border-neutral-200"}`}>
      <PlatformPreview draft={draft} referenceImage={referenceImage} />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">Candidate {draft.candidate_index + 1}</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">v{draft.version}{draft.parent_draft_id ? " ↺" : ""}</span>
          <span className={`rounded-full px-2 py-0.5 ${draft.status === "approved" ? "bg-emerald-100 text-emerald-800" : draft.status === "rejected" ? "bg-neutral-200" : "bg-amber-100 text-amber-800"}`}>{draft.status}</span>
        </div>
        {draft.change_notes.length > 0 && (
          <div className="rounded-lg bg-violet-50 p-3 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-violet-700">What changed</div>
            <ul className="mt-1 list-disc pl-4 text-violet-900">{draft.change_notes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
        {mode === "edit" ? (
          <div className="space-y-2">
            <label className="block text-sm">Hook<input value={edits.hook} onChange={(e) => setEdits({ ...edits, hook: e.target.value })} className={input} /></label>
            <label className="block text-sm">Caption<textarea rows={5} value={edits.caption} onChange={(e) => setEdits({ ...edits, caption: e.target.value })} className={input} /></label>
            <label className="block text-sm">Hashtags (space-separated)<input value={edits.hashtags} onChange={(e) => setEdits({ ...edits, hashtags: e.target.value })} className={input} /></label>
            <label className="block text-sm">First comment<input value={edits.firstComment} onChange={(e) => setEdits({ ...edits, firstComment: e.target.value })} className={input} /></label>
            <label className="block text-sm">Alt text<input value={edits.altText} onChange={(e) => setEdits({ ...edits, altText: e.target.value })} className={input} /></label>
          </div>
        ) : (
          <div className="text-sm text-neutral-600">
            {draft.alt_text && <p><span className="text-neutral-400">Alt:</span> {draft.alt_text}</p>}
            <p className="mt-1"><span className="text-neutral-400">Media plan:</span> {draft.media_plan.kind.replace("_", " ")}</p>
          </div>
        )}
        {mode === "reject" && (
          <label className="block text-sm">What&apos;s wrong? (optional)
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell it what's wrong, or leave blank to let it guess." className={input} />
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="mt-auto flex flex-wrap gap-2">
          {mode === "view" && (<>
            <button disabled={disabled} onClick={() => run("approve")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">{busy === "approve" ? "Approving…" : "Approve"}</button>
            <button disabled={disabled} onClick={() => setMode("edit")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40">Edit</button>
            <button disabled={disabled} onClick={() => setMode("reject")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40">Reject</button>
            <button disabled={disabled} onClick={() => run("regenerate")} className="rounded-lg border border-violet-300 text-violet-800 px-3 py-1.5 text-sm disabled:opacity-40">{busy === "regenerate" ? "Thinking…" : "Regenerate"}</button>
          </>)}
          {mode === "edit" && (<>
            <button disabled={disabled} onClick={() => run("edit", { edits: { hook: edits.hook, caption: edits.caption, hashtags: edits.hashtags.split(/\s+/).filter(Boolean), firstComment: edits.firstComment || null, altText: edits.altText || null } })} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">{busy === "edit" ? "Saving…" : "Save edits"}</button>
            <button disabled={busy !== null} onClick={() => setMode("view")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Cancel</button>
          </>)}
          {mode === "reject" && (<>
            <button disabled={disabled} onClick={() => run("reject", { note })} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">{busy === "reject" ? "Regenerating…" : "Reject & regenerate"}</button>
            <button disabled={busy !== null} onClick={() => setMode("view")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Cancel</button>
          </>)}
        </div>
      </div>
    </div>
  );
}
