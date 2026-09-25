"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Inbox, PenLine, Gem, CalendarDays, BarChart3, Link2, Settings } from "lucide-react";

export const NAV = [
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/campaigns/new", label: "New campaign", Icon: PenLine },
  { href: "/brand", label: "Brand", Icon: Gem },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/connections", label: "Connections", Icon: Link2 },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function pageTitle(path: string): string {
  return NAV.find((n) => path === n.href || path.startsWith(n.href + "/"))?.label ?? "Postpilot";
}

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV.map(({ href, label, Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${active ? "text-fg" : "text-fg-muted hover:bg-muted hover:text-fg"}`}>
            {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-muted" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <Icon size={20} strokeWidth={1.75} className={`relative shrink-0 ${active ? "text-accent" : "text-fg-subtle"}`} />
            <span className="relative whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
