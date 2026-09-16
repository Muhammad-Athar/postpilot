"use client";
import { useTransition } from "react";
import { addBrand } from "@/app/(app)/actions";

export function AddBrandButton() {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => { const name = window.prompt("Brand name"); if (name) start(() => addBrand(name)); }}
      className="w-full rounded-lg border border-dashed border-neutral-300 px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
    >
      + Add brand
    </button>
  );
}
