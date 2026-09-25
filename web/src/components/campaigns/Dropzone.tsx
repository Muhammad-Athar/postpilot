"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Film, ImagePlus, X } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

const MAX = 20 * 1024 * 1024;
const fmt = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export function Dropzone({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(list: FileList | File[]) {
    const incoming = Array.from(list).filter((f) => /^(image\/|video\/(mp4|quicktime))/.test(f.type));
    const big = incoming.find((f) => f.size > MAX);
    setError(big ? `${big.name} is over 20 MB.` : null);
    onChange([...files, ...incoming.filter((f) => f.size <= MAX)].slice(0, 10));
  }

  return (
    <div>
      <motion.div
        role="button" tabIndex={0} aria-label="Add reference images or a video"
        onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        animate={{ scale: over ? 1.01 : 1 }}
        className={`cursor-pointer rounded-xl border border-dashed px-5 py-7 text-center transition-colors ${over ? "border-accent bg-accent-soft/40" : "border-line-strong bg-bg hover:border-accent hover:bg-accent-soft/20"}`}
      >
        <ImagePlus size={26} strokeWidth={1.5} className="mx-auto text-accent-strong dark:text-accent" />
        <div className="mt-2 text-sm"><span className="font-medium">Drop images or a video</span> <span className="text-fg-muted">or click to browse</span></div>
        <div className="mt-1 text-xs text-fg-subtle">PNG, JPG, WebP, MP4, MOV · up to 20 MB each · your own media is used first, stock second</div>
        <input ref={input} type="file" multiple accept="image/*,video/mp4,video/quicktime" className="hidden" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </motion.div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((f, i) => (
              <motion.li key={`${f.name}-${i}`} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="group relative overflow-hidden rounded-lg border border-line bg-muted">
                {f.type.startsWith("image/") ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- local preview */
                  <img src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="grid aspect-square place-items-center text-fg-subtle"><Film size={22} /></div>
                )}
                <div className="truncate px-1.5 py-1 text-[10px] text-fg-muted">{f.name} · {fmt(f.size)}</div>
                <Tooltip label="Remove"><button type="button" onClick={(e) => { e.stopPropagation(); onChange(files.filter((_, j) => j !== i)); }} className="absolute right-1 top-1 rounded-full bg-fg/70 p-1 text-bg opacity-0 transition-opacity group-hover:opacity-100" aria-label={`Remove ${f.name}`}><X size={12} /></button></Tooltip>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
