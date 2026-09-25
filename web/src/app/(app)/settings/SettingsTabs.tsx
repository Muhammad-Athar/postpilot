"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, UserRound, KeyRound, Gem } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent, TabPanelMotion } from "@/components/ui/Tabs";
import type { ReactNode } from "react";

const TABS = [
  { value: "workspace", label: "Workspace", Icon: Building2 },
  { value: "profile", label: "Profile", Icon: UserRound },
  { value: "password", label: "Password", Icon: KeyRound },
  { value: "brand", label: "Brand", Icon: Gem },
] as const;

export function SettingsTabs({ panels }: { panels: Record<(typeof TABS)[number]["value"], ReactNode> }) {
  const router = useRouter();
  const params = useSearchParams();
  const raw = (params.get("tab") as keyof typeof panels) || "workspace";
  const current = raw in panels ? raw : "workspace";
  const idx = (v: string) => TABS.findIndex((t) => t.value === v);
  // slide direction derived from the previous tab; state adjusted during render (React's "previous value" pattern)
  const [track, setTrack] = useState({ tab: current, direction: 1 });
  let direction = track.direction;
  if (track.tab !== current) { direction = idx(current) >= idx(track.tab) ? 1 : -1; setTrack({ tab: current, direction }); }
  return (
    <Tabs value={current} onValueChange={(v) => router.replace(`/settings?tab=${v}`)} orientation="vertical" className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div className="md:sticky md:top-24 md:self-start">
        <TabsList vertical>
          {TABS.map(({ value, label, Icon }) => <TabsTrigger key={value} value={value} active={value === current} icon={<Icon size={18} strokeWidth={1.75} />}>{label}</TabsTrigger>)}
        </TabsList>
      </div>
      <div className="min-w-0 overflow-hidden">
        {TABS.map(({ value }) => (
          <TabsContent key={value} value={value} className="outline-none">
            <TabPanelMotion key={`${value}-${direction}`} direction={direction}>{panels[value]}</TabPanelMotion>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
