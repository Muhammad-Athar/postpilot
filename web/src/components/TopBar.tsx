"use client";
import { usePathname } from "next/navigation";
import { pageTitle } from "@/components/AppNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";

export function TopBar({ brandName }: { brandName: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/70 bg-bg/80 px-5 backdrop-blur md:px-8">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-2xl tracking-tight">{pageTitle(path)}</h1>
        <span className="hidden text-sm text-fg-subtle sm:inline">· {brandName}</span>
      </div>
      <div className="flex items-center gap-3">
        <Tooltip label="Switch light / dark"><span><ThemeToggle /></span></Tooltip>
      </div>
    </header>
  );
}
