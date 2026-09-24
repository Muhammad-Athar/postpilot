import { getSession } from "@/lib/auth/session";
import { BrandSwitcher } from "@/components/BrandSwitcher";
import { AddBrandButton } from "@/components/AddBrandButton";
import { AppNav } from "@/components/AppNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Badge } from "@/components/ui/Badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace, brand, brands, user } = await getSession();
  return (
    <div className="relative z-10 min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-5 border-b border-line bg-elev/70 p-4 backdrop-blur md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-2xl leading-none">Postpilot</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-fg-subtle">
              <span className="truncate max-w-[120px]">{workspace.name}</span>
              <Badge tone={workspace.mode === "agency" ? "accent" : "neutral"}>{workspace.mode}</Badge>
            </div>
          </div>
          <ThemeToggle />
        </div>
        {workspace.mode === "agency" ? (
          <div className="space-y-2">
            <BrandSwitcher brands={brands} currentId={brand.id} />
            <AddBrandButton />
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-bg px-3 py-2 text-sm"><span className="text-fg-subtle">Brand · </span>{brand.name}</div>
        )}
        <AppNav />
        <form action="/api/auth/signout" method="post" className="mt-auto flex items-center justify-between text-xs text-fg-subtle">
          <span className="truncate">{user.email}</span>
          <button className="rounded-lg px-2 py-1 transition-colors hover:bg-muted hover:text-fg">Sign out</button>
        </form>
      </aside>
      <main className="min-w-0 p-5 md:p-10">{children}</main>
    </div>
  );
}
