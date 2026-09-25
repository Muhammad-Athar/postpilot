"use client";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound, Link2, SunMoon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/DropdownMenu";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AccountMenu({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex cursor-pointer items-center gap-2.5 rounded-full border border-transparent py-1 pl-1 pr-2.5 text-sm transition-colors hover:border-line hover:bg-elev data-[state=open]:border-line data-[state=open]:bg-elev">
          <Avatar name={name || email} src={avatarUrl} size={32} />
          <span className="hidden max-w-[160px] truncate font-medium sm:inline">{name || email.split("@")[0]}</span>
          <ChevronDown size={16} className="text-fg-subtle" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{email}</MenuLabel>
        <MenuItem asChild><Link href="/settings?tab=profile"><UserRound size={16} /> Profile</Link></MenuItem>
        <MenuItem asChild><Link href="/settings"><Settings size={16} /> Settings</Link></MenuItem>
        <MenuItem asChild><Link href="/connections"><Link2 size={16} /> Connections</Link></MenuItem>
        <MenuSeparator />
        <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="flex items-center gap-2.5"><SunMoon size={16} className="text-fg-subtle" /> Theme</span><ThemeToggle /></div>
        <MenuSeparator />
        <form action="/api/auth/signout" method="post">
          <MenuItem asChild danger><button type="submit" className="w-full"><LogOut size={16} /> Sign out</button></MenuItem>
        </form>
      </MenuContent>
    </Menu>
  );
}
