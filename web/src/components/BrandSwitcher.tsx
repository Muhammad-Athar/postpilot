"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setBrandCookie } from "@/app/(app)/actions";

export function BrandSwitcher({ brands, currentId }: { brands: { id: string; name: string }[]; currentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
      value={currentId}
      disabled={pending}
      onChange={(e) => start(async () => { await setBrandCookie(e.target.value); router.refresh(); })}
    >
      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
