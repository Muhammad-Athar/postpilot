import { PLATFORM_RULES } from "@/lib/platforms/rules";
import type { DraftRow } from "@/lib/drafts/types";

/** Platform-shaped preview. Purely presentational. */
export function PlatformPreview({ draft, referenceImage }: { draft: DraftRow; referenceImage?: string }) {
  const rules = PLATFORM_RULES[draft.platform];
  const media = draft.media_urls[0] ?? (draft.media_plan.kind === "use_reference_image" ? referenceImage : undefined);
  const plan = draft.media_plan;
  const isVertical = rules.aspect === "9:16";
  const over = draft.caption.length > rules.captionMax;
  const frame = isVertical ? "aspect-[9/16] max-h-72 mx-auto w-[46%]" : rules.aspect === "1:1" ? "aspect-square" : rules.aspect === "4:5" ? "aspect-[4/5]" : "aspect-video";

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg text-sm">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft font-serif text-[13px] text-accent-strong dark:text-accent" aria-hidden>{rules.label[0]}</span>
        <span className="font-medium">{rules.label}</span>
        <span className="ml-auto text-[11px] text-fg-subtle">{rules.aspect}</span>
      </div>
      <div className={`relative bg-muted ${frame}`}>
        {media ? (
          /* eslint-disable-next-line @next/next/no-img-element -- remote preview media */
          <img src={media} alt={draft.alt_text ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            {plan.kind === "video" ? (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Short · {plan.scenes.length} scenes</div>
                <div className="mt-2 font-serif text-lg leading-snug">{plan.scenes[0]?.onScreenText || draft.hook}</div>
              </div>
            ) : plan.kind === "carousel" ? (
              <div className="text-xs text-fg-muted">Carousel · {plan.slides.length} slides<br /><span className="font-serif text-base text-fg">{plan.slides[0]?.title}</span></div>
            ) : plan.kind === "generate_image" ? (
              <div className="text-xs text-fg-muted">Image to generate<br /><span className="italic">{plan.prompt.slice(0, 110)}</span></div>
            ) : (
              <div className="text-xs text-fg-subtle">Text only</div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1 px-3 py-2.5">
        <p className="whitespace-pre-wrap leading-snug"><span className="font-semibold">{draft.hook}</span>{draft.caption.startsWith(draft.hook) ? draft.caption.slice(draft.hook.length) : `\n${draft.caption}`}</p>
        {!rules.firstCommentHashtags && draft.hashtags.length > 0 && <p className="text-info">{draft.hashtags.join(" ")}</p>}
        {rules.firstCommentHashtags && draft.first_comment && <p className="border-t border-line pt-1 text-xs text-fg-subtle">First comment: <span className="text-info">{draft.first_comment}</span></p>}
        <div className={`text-[11px] ${over ? "text-danger" : "text-fg-subtle"}`}>{draft.caption.length}/{rules.captionMax}</div>
      </div>
    </div>
  );
}
