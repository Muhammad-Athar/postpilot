import { getSession } from "@/lib/auth/session";
import { BrandSwitcher } from "@/components/BrandSwitcher";
import { AddBrandButton } from "@/components/AddBrandButton";
import { AppNav } from "@/components/AppNav";
import { TopBar } from "@/components/TopBar";
import { AccountMenu } from "@/components/AccountMenu";
import { Badge } from "@/components/ui/Badge";
import { BrandNameInline } from "@/components/BrandNameInline";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace, brand, brands, user } = await getSession();
  const meta = (user.user_metadata ?? {}) as { display_name?: string; avatar_url?: string };
  return (
    <div className="relative z-10 min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-5 border-b border-line bg-elev/70 p-4 backdrop-blur md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div>
          <div className="font-serif text-2xl leading-none">Postpilot</div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-fg-subtle">
            <span className="max-w-[130px] truncate">{workspace.name}</span>
            <Badge tone={workspace.mode === "agency" ? "accent" : "neutral"}>{workspace.mode}</Badge>
          </div>
        </div>
        {workspace.mode === "agency" ? (
          <div className="space-y-2">
            <BrandSwitcher brands={brands} currentId={brand.id} />
            <AddBrandButton />
          </div>
        ) : (
          <BrandNameInline brandId={brand.id} name={brand.name} />
        )}
        <AppNav />
        <div className="mt-auto border-t border-line pt-3">
          <AccountMenu name={meta.display_name ?? ""} email={user.email ?? ""} avatarUrl={meta.avatar_url ?? null} />
        </div>
      </aside>
      <div className="min-w-0">
        <TopBar brandName={brand.name} />
        <main className="p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
