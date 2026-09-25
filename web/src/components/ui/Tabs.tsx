"use client";
import * as T from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const Tabs = T.Root;
export const TabsContent = T.Content;
export function TabsList({ children, vertical = false }: { children: ReactNode; vertical?: boolean }) {
  return <T.List className={`flex gap-1 ${vertical ? "flex-col" : "flex-row overflow-x-auto"}`}>{children}</T.List>;
}
/** `active` must be passed by the parent so only one trigger mounts the shared indicator, which is what makes it slide. */
export function TabsTrigger({ value, children, icon, active = false, layoutId = "tab-active" }: { value: string; children: ReactNode; icon?: ReactNode; active?: boolean; layoutId?: string }) {
  return (
    <T.Trigger value={value} className={`group relative flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 ${active ? "text-fg" : "text-fg-muted hover:text-fg"}`}>
      {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-muted" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
      {icon && <span className={`relative transition-colors ${active ? "text-accent" : "text-fg-subtle"}`}>{icon}</span>}
      <span className="relative">{children}</span>
    </T.Trigger>
  );
}

/** Slide-in wrapper for a panel; key it by the tab value and pass the travel direction (-1 up, 1 down). */
export function TabPanelMotion({ children, direction = 1, className = "" }: { children: ReactNode; direction?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: direction * 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}
