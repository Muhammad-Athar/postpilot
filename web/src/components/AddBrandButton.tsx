"use client";
import { useTransition } from "react";
import { addBrand } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";

export function AddBrandButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" block loading={pending} onClick={() => { const name = window.prompt("Brand name"); if (name) start(() => addBrand(name)); }}>
      + Add brand
    </Button>
  );
}
