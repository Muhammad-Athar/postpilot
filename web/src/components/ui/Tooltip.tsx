"use client";
import * as T from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <T.Provider delayDuration={150} skipDelayDuration={300}>{children}</T.Provider>;
}

export function Tooltip({ label, children, side = "top" }: { label: React.ReactNode; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} collisionPadding={12} asChild>
          <motion.div
            initial={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="z-50 max-w-[260px] rounded-xl bg-fg px-3 py-2 text-[13px] leading-snug text-bg shadow-lift"
          >
            {label}
            <T.Arrow className="fill-[var(--fg)]" width={10} height={5} />
          </motion.div>
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
