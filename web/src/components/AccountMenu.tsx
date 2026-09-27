"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings, UserRound, Link2, SunMoon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/DropdownMenu";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AccountMenu({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {
  const router = useRouter();
  const signOut = () => { void fetch("/api/auth/signout", { method: "post" }).finally(() => { router.replace("/login"); router.refresh(); }); };
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left text-sm transition-colors hover:border-line hover:bg-bg data-[state=open]:border-line data-[state=open]:bg-bg">
          <Avatar name={name || email} src={avatarUrl} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{name || email.split("@")[0]}</span>
            <span className="block truncate text-xs text-fg-subtle">{email}</span>
          </span>
          <ChevronsUpDown size={16} className="shrink-0 text-fg-subtle" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" side="right">
        <MenuLabel>{email}</MenuLabel>
        <MenuItem asChild><Link href="/settings?tab=profile"><UserRound size={16} /> Profile</Link></MenuItem>
        <MenuItem asChild><Link href="/settings"><Settings size={16} /> Settings</Link></MenuItem>
        <MenuItem asChild><Link href="/connections"><Link2 size={16} /> Connections</Link></MenuItem>
        <MenuSeparator />
        <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="flex items-center gap-2.5"><SunMoon size={16} className="text-fg-subtle" /> Theme</span><ThemeToggle /></div>
        <MenuSeparator />
        {/* Radix closes the menu on select before a native form submit can fire, so post explicitly. */}
        <MenuItem danger onSelect={signOut}>
          <LogOut size={16} /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
