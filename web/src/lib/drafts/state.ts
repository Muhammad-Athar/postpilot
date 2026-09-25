export type DraftStatus = "draft" | "approved" | "rejected" | "scheduled" | "published" | "failed";

const ALLOWED: Record<DraftStatus, DraftStatus[]> = {
  draft: ["approved", "rejected"],
  approved: ["scheduled"],
  rejected: [],
  scheduled: ["published", "failed", "approved"],
  published: [],
  failed: ["scheduled"],
};

/** Mirrors the enforce_draft_transition trigger in 0001_init.sql. */
export const canTransition = (from: DraftStatus, to: DraftStatus): boolean => ALLOWED[from].includes(to);
