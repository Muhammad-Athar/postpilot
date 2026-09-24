"use client";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { motion } from "framer-motion";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border border-line bg-muted transition-colors hover:border-line-strong ${className}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute top-0.5 grid h-6.5 w-6.5 place-items-center rounded-full bg-elev shadow-card text-[13px]"
        style={{ left: dark ? "calc(100% - 28px)" : "2px" }}
      >
        {dark ? "☾" : "☀︎"}
      </motion.span>
    </button>
  );
}
