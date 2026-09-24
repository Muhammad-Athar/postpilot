"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setBrandCookie } from "@/app/(app)/actions";
import { Select } from "@/components/ui/Field";

export function BrandSwitcher({ brands, currentId }: { brands: { id: string; name: string }[]; currentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select className="mt-0" value={currentId} disabled={pending} onChange={(e) => start(async () => { await setBrandCookie(e.target.value); router.refresh(); })}>
      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>
  );
}
