import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { BrandSwitcher } from "@/components/BrandSwitcher";
import { AddBrandButton } from "@/components/AddBrandButton";

const NAV = [
  ["/inbox", "Inbox"],
  ["/campaigns/new", "New campaign"],
  ["/brand", "Brand"],
  ["/calendar", "Calendar"],
  ["/analytics", "Analytics"],
  ["/settings", "Settings"],
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace, brand, brands } = await getSession();
  return (
    <div className="min-h-screen bg-neutral-50 md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-neutral-200 bg-white p-4 flex flex-col gap-4">
        <div>
          <div className="text-lg font-semibold tracking-tight">Postpilot</div>
          <div className="text-xs text-neutral-500">{workspace.name} · {workspace.mode}</div>
        </div>
        {workspace.mode === "agency" ? (
          <div className="space-y-2">
            <BrandSwitcher brands={brands} currentId={brand.id} />
            <AddBrandButton />
          </div>
        ) : (
          <div className="text-sm font-medium">{brand.name}</div>
        )}
        <nav className="flex md:flex-col gap-1 flex-wrap">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-100">{label}</Link>
          ))}
        </nav>
        <form action="/api/auth/signout" method="post" className="mt-auto">
          <button className="text-sm text-neutral-500 hover:text-neutral-900">Sign out</button>
        </form>
      </aside>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
