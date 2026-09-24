"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const NAV = [
  ["/inbox", "Inbox", "☰"],
  ["/campaigns/new", "New campaign", "✎"],
  ["/brand", "Brand", "◆"],
  ["/calendar", "Calendar", "▦"],
  ["/analytics", "Analytics", "◔"],
  ["/settings", "Settings", "⚙"],
] as const;

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV.map(([href, label, icon]) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${active ? "text-fg" : "text-fg-muted hover:bg-muted hover:text-fg"}`}>
            {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-muted" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative w-4 text-center text-fg-subtle">{icon}</span>
            <span className="relative whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
