"use client";
import * as T from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const Tabs = T.Root;
export const TabsContent = T.Content;
export function TabsList({ children, vertical = false }: { children: ReactNode; vertical?: boolean }) {
  return <T.List className={`flex gap-1 ${vertical ? "flex-col" : "flex-row overflow-x-auto"}`}>{children}</T.List>;
}
export function TabsTrigger({ value, children, icon, layoutId = "tab-active" }: { value: string; children: ReactNode; icon?: ReactNode; layoutId?: string }) {
  return (
    <T.Trigger value={value} className="group relative flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] text-fg-muted outline-none transition-colors hover:text-fg data-[state=active]:text-fg focus-visible:ring-2 focus-visible:ring-accent/60">
      <ActiveBg layoutId={layoutId} />
      {icon && <span className="relative text-fg-subtle group-data-[state=active]:text-accent">{icon}</span>}
      <span className="relative">{children}</span>
    </T.Trigger>
  );
}
function ActiveBg({ layoutId }: { layoutId: string }) {
  return <motion.span layoutId={layoutId} className="absolute inset-0 hidden rounded-xl bg-muted group-data-[state=active]:block" transition={{ type: "spring", stiffness: 500, damping: 40 }} />;
}
