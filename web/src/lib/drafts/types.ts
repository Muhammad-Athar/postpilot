import type { Platform } from "@/lib/platforms/rules";
import type { MediaPlan } from "@/lib/generation/schema";

export type DraftStatus = "draft" | "approved" | "rejected" | "scheduled" | "published" | "failed";

export interface DraftRow {
  id: string;
  campaign_id: string;
  brand_id: string;
  platform: Platform;
  candidate_index: number;
  version: number;
  parent_draft_id: string | null;
  hook: string;
  caption: string;
  hashtags: string[];
  first_comment: string | null;
  alt_text: string | null;
  media_plan: MediaPlan;
  media_urls: string[];
  change_notes: string[];
  status: DraftStatus;
  permalink: string | null;
  publish_error: string | null;
  published_at: string | null;
  /** From the schedule_slots relation; present when the inbox query joins it. */
  schedule_slots?: { scheduled_at: string; status: string }[];
  created_at: string;
  updated_at: string;
}

export interface CampaignRow {
  id: string;
  prompt: string;
  status: "queued" | "generating" | "review" | "done" | "failed";
  error: string | null;
  settings: { platforms?: Platform[]; candidatesPerSlot?: number };
  references: { kind: "image" | "video" | "url"; url: string; name?: string }[];
  created_at: string;
}

export type DraftAction = "approve" | "edit" | "reject" | "regenerate" | "retry";
