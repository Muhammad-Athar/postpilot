"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, UserRound, KeyRound, Gem } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
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
  const current = (params.get("tab") as keyof typeof panels) || "workspace";
  return (
    <Tabs value={current in panels ? current : "workspace"} onValueChange={(v) => router.replace(`/settings?tab=${v}`)} orientation="vertical" className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div className="md:sticky md:top-24 md:self-start">
        <TabsList vertical>
          {TABS.map(({ value, label, Icon }) => <TabsTrigger key={value} value={value} icon={<Icon size={18} strokeWidth={1.75} />}>{label}</TabsTrigger>)}
        </TabsList>
      </div>
      <div className="min-w-0">
        {TABS.map(({ value }) => <TabsContent key={value} value={value} className="outline-none">{panels[value]}</TabsContent>)}
      </div>
    </Tabs>
  );
}
