import { PLATFORM_RULES } from "@/lib/platforms/rules";
import type { DraftRow } from "@/lib/drafts/types";

/** Platform-shaped preview. Purely presentational. */
export function PlatformPreview({ draft, referenceImage }: { draft: DraftRow; referenceImage?: string }) {
  const rules = PLATFORM_RULES[draft.platform];
  const media = draft.media_urls[0] ?? (draft.media_plan.kind === "use_reference_image" ? referenceImage : undefined);
  const plan = draft.media_plan;
  const isVertical = rules.aspect === "9:16";
  const over = draft.caption.length > rules.captionMax;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden text-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100">
        <span className="h-6 w-6 rounded-full bg-neutral-200" aria-hidden />
        <span className="font-medium">{rules.label}</span>
        <span className="ml-auto text-xs text-neutral-500">{rules.aspect}</span>
      </div>
      <div className={`relative bg-neutral-100 ${isVertical ? "aspect-[9/16] max-h-80 mx-auto w-[45%]" : rules.aspect === "1:1" ? "aspect-square" : rules.aspect === "4:5" ? "aspect-[4/5]" : "aspect-video"}`}>
        {media ? (
          /* eslint-disable-next-line @next/next/no-img-element -- remote preview media */
          <img src={media} alt={draft.alt_text ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            {plan.kind === "video" ? (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">Short · {plan.scenes.length} scenes</div>
                <div className="mt-2 font-semibold leading-snug text-neutral-800">{plan.scenes[0]?.onScreenText || draft.hook}</div>
              </div>
            ) : plan.kind === "carousel" ? (
              <div className="text-xs text-neutral-600">Carousel · {plan.slides.length} slides<br /><span className="font-medium text-neutral-800">{plan.slides[0]?.title}</span></div>
            ) : plan.kind === "generate_image" ? (
              <div className="text-xs text-neutral-600">Image to generate<br /><span className="italic">{plan.prompt.slice(0, 120)}</span></div>
            ) : (
              <div className="text-xs text-neutral-500">Text only</div>
            )}
          </div>
        )}
      </div>
      <div className="px-3 py-2 space-y-1">
        <p className="whitespace-pre-wrap leading-snug"><span className="font-semibold">{draft.hook}</span>{draft.caption.startsWith(draft.hook) ? draft.caption.slice(draft.hook.length) : `\n${draft.caption}`}</p>
        {!rules.firstCommentHashtags && draft.hashtags.length > 0 && <p className="text-sky-700">{draft.hashtags.join(" ")}</p>}
        {rules.firstCommentHashtags && draft.first_comment && <p className="text-xs text-neutral-500 border-t border-neutral-100 pt-1">First comment: <span className="text-sky-700">{draft.first_comment}</span></p>}
        <div className={`text-[11px] ${over ? "text-red-600" : "text-neutral-400"}`}>{draft.caption.length}/{rules.captionMax}</div>
      </div>
    </div>
  );
}
