"use client";
import * as D from "@radix-ui/react-dropdown-menu";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const Menu = D.Root;
export const MenuTrigger = D.Trigger;
export function MenuContent({ children, align = "end", side = "bottom" }: { children: ReactNode; align?: "start" | "end"; side?: "top" | "bottom" }) {
  return (
    <D.Portal>
      <D.Content align={align} side={side} sideOffset={8} collisionPadding={12} asChild>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: side === "top" ? 4 : -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="z-50 min-w-[220px] rounded-2xl border border-line bg-elev p-1.5 shadow-lift">
          {children}
        </motion.div>
      </D.Content>
    </D.Portal>
  );
}
export function MenuItem({ children, onSelect, danger = false, asChild = false }: { children: ReactNode; onSelect?: () => void; danger?: boolean; asChild?: boolean }) {
  return (
    <D.Item asChild={asChild} onSelect={onSelect}
      className={`flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-muted ${danger ? "text-danger" : "text-fg"}`}>
      {children}
    </D.Item>
  );
}
export function MenuLabel({ children }: { children: ReactNode }) {
  return <D.Label className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-fg-subtle">{children}</D.Label>;
}
export function MenuSeparator() { return <D.Separator className="my-1.5 h-px bg-line" />; }
